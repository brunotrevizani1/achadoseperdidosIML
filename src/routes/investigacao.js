const express = require('express');
const { query, withUser } = require('../db');
const { ErroHttp } = require('../erros');
const { exigePerfil } = require('../auth');
const c = require('../consultas');

const router = express.Router();

// Rotina de gravação das sugestões (seção 7 da especificação)
router.post('/cruzamento/rodar', exigePerfil('INVESTIGADOR', 'PERITO'), async (req, res) => {
  const novas = await withUser(req.session.usuario.id_usuario, async (db) => {
    const { rows } = await db.query('SELECT fn_gerar_correspondencias() AS novas');
    return rows[0].novas;
  });
  res.json({ novas });
});

router.get('/correspondencias', async (req, res) => {
  const { status } = req.query;
  const { rows } = await query(
    `SELECT co.id_correspondencia, co.status, co.origem, co.data_geracao, co.justificativa,
            co.pts_sexo, co.pts_idade, co.pts_altura, co.pts_local, co.pts_data, co.pts_sinais,
            co.score_total,
            c.id_corpo, c.codigo_iml, c.sexo AS sexo_corpo, c.idade_estimada_min, c.idade_estimada_max,
            c.altura_estimada_cm, c.estado_conservacao, c.gaveta_camara, e.data_encontrado,
            lc.cidade AS cidade_corpo, lc.uf AS uf_corpo,
            d.id_desaparecido, d.protocolo, d.nome_desaparecido, d.apelido, d.sexo AS sexo_desap,
            d.altura_cm AS altura_desap, d.data_desaparecimento,
            COALESCE(EXTRACT(YEAR FROM age(e.data_encontrado, d.data_nascimento))::INT,
                     d.idade_desaparecimento) AS idade_desap,
            ld.cidade AS cidade_desap, ld.uf AS uf_desap,
            (SELECT count(*) FROM correspondencia_sinal cs
              WHERE cs.id_correspondencia = co.id_correspondencia)::INT AS sinais_coincidentes,
            (SELECT count(*) FROM sinal_particular s
              WHERE s.id_desaparecido = d.id_desaparecido)::INT AS sinais_desap,
            ua.nome AS analista
       FROM correspondencia co
       JOIN corpo c USING (id_corpo)
       JOIN registro_entrada e ON e.id_corpo = c.id_corpo
       JOIN local lc ON lc.id_local = e.id_local
       JOIN registro_desaparecimento d USING (id_desaparecido)
       LEFT JOIN local ld ON ld.id_local = d.id_local
       LEFT JOIN usuario ua ON ua.id_usuario = co.id_usuario_analise
      WHERE ($1::TEXT IS NULL OR co.status = ANY (string_to_array($1, ',')))
      ORDER BY (co.status = 'EM_ANALISE') DESC, co.score_total DESC, co.id_correspondencia`,
    [status || null]
  );
  res.json(rows);
});

router.get('/correspondencias/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(
    `SELECT co.*, ua.nome AS analista FROM correspondencia co
       LEFT JOIN usuario ua ON ua.id_usuario = co.id_usuario_analise
      WHERE co.id_correspondencia = $1`,
    [id]
  );
  const corresp = rows[0];
  if (!corresp) throw new ErroHttp(404, 'Correspondência não encontrada.');

  const [corpo, desap, coincidencias, analises, exames, familiares, ident, lib, historico,
         sinaisCorpo, sinaisDesap] = await Promise.all([
    query(
      `SELECT c.*, e.data_encontrado, e.orgao_remocao, e.circunstancias, l.nome AS local_nome,
              l.cidade, l.uf, cm.descricao AS causa_presumida
         FROM corpo c
         JOIN registro_entrada e USING (id_corpo)
         JOIN local l ON l.id_local = e.id_local
         LEFT JOIN causa_morte cm ON cm.id_causa = e.id_causa_presumida
        WHERE c.id_corpo = $1`,
      [corresp.id_corpo]
    ),
    query(
      `SELECT d.*, l.nome AS local_nome, l.cidade, l.uf,
              COALESCE(EXTRACT(YEAR FROM age(e.data_encontrado, d.data_nascimento))::INT,
                       d.idade_desaparecimento) AS idade_na_data
         FROM registro_desaparecimento d
         LEFT JOIN local l USING (id_local)
         CROSS JOIN registro_entrada e
        WHERE d.id_desaparecido = $1 AND e.id_corpo = $2`,
      [corresp.id_desaparecido, corresp.id_corpo]
    ),
    query(
      `SELECT cs.id_sinal_corpo, cs.id_sinal_desaparecido, cs.grau_similaridade, cs.observacao
         FROM correspondencia_sinal cs WHERE cs.id_correspondencia = $1`,
      [id]
    ),
    query(
      `SELECT a.*, u.nome AS usuario, x.numero_laudo, x.tipo_exame
         FROM analise_investigacao a
         JOIN usuario u USING (id_usuario)
         LEFT JOIN exame_pericial x USING (id_exame)
        WHERE a.id_correspondencia = $1 ORDER BY a.data_analise`,
      [id]
    ),
    query(
      `SELECT id_exame, tipo_exame, numero_laudo, status, data_realizacao, conclusao
         FROM exame_pericial WHERE id_corpo = $1 ORDER BY data_solicitacao`,
      [corresp.id_corpo]
    ),
    query(
      `SELECT f.id_familiar, f.nome, f.telefone, fd.parentesco, fd.comunicante, fd.doador_dna
         FROM familiar_desaparecido fd JOIN familiar f USING (id_familiar)
        WHERE fd.id_desaparecido = $1 ORDER BY fd.comunicante DESC, f.nome`,
      [corresp.id_desaparecido]
    ),
    query(
      `SELECT i.*, u.nome AS perito FROM identificacao i
         JOIN usuario u ON u.id_usuario = i.id_perito
        WHERE i.id_corpo = $1`,
      [corresp.id_corpo]
    ),
    query(
      `SELECT lb.*, f.nome AS familiar FROM liberacao_corpo lb
         JOIN familiar f USING (id_familiar) WHERE lb.id_corpo = $1`,
      [corresp.id_corpo]
    ),
    c.historico({ query }, 'CORRESPONDENCIA', id),
    c.sinaisDoCorpo({ query }, corresp.id_corpo),
    c.sinaisDoDesaparecido({ query }, corresp.id_desaparecido),
  ]);

  res.json({
    ...corresp,
    corpo: { ...corpo.rows[0], sinais: sinaisCorpo },
    desaparecido: { ...desap.rows[0], sinais: sinaisDesap, familiares: familiares.rows },
    coincidencias: coincidencias.rows,
    analises: analises.rows,
    exames: exames.rows,
    identificacao: ident.rows[0] || null,
    liberacao: lib.rows[0] || null,
    historico,
  });
});

const ACOES = {
  assumir: { status: 'EM_ANALISE', de: ['SUGERIDA'] },
  descartar: { status: 'DESCARTADA', de: ['SUGERIDA', 'EM_ANALISE'] },
  confirmar: { status: 'CONFIRMADA', de: ['EM_ANALISE'] },
};

router.patch('/correspondencias/:id', exigePerfil('INVESTIGADOR'), async (req, res) => {
  const { acao, justificativa } = req.body || {};
  const regra = ACOES[acao];
  if (!regra) throw new ErroHttp(422, 'Ação inválida. Opções: assumir, descartar, confirmar.');

  const linha = await withUser(
    req.session.usuario.id_usuario,
    async (db) => {
      const atual = await db.query('SELECT status FROM correspondencia WHERE id_correspondencia = $1', [
        req.params.id,
      ]);
      if (!atual.rows[0]) throw new ErroHttp(404, 'Correspondência não encontrada.');
      if (!regra.de.includes(atual.rows[0].status)) {
        throw new ErroHttp(422, `Não dá para ${acao} uma correspondência ${atual.rows[0].status}.`);
      }
      // A justificativa vazia vai como NULL para o CHECK do banco decidir
      const { rows } = await db.query(
        `UPDATE correspondencia SET status = $1, justificativa = COALESCE(NULLIF(trim($2), ''), justificativa)
          WHERE id_correspondencia = $3
          RETURNING id_correspondencia, status, justificativa`,
        [regra.status, justificativa || '', req.params.id]
      );
      return rows[0];
    },
    justificativa
  );
  res.json(linha);
});

router.post('/correspondencias/:id/analises', exigePerfil('INVESTIGADOR', 'PERITO'), async (req, res) => {
  const b = req.body || {};
  const analise = await withUser(req.session.usuario.id_usuario, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO analise_investigacao (id_correspondencia, tipo_analise, id_exame, id_usuario,
                                         resultado, descricao)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, b.tipo_analise, c.vazioParaNulo(b.id_exame), req.session.usuario.id_usuario,
       b.resultado, c.vazioParaNulo(b.descricao)]
    );
    return rows[0];
  });
  res.status(201).json(analise);
});

router.post('/identificacoes', exigePerfil('PERITO'), async (req, res) => {
  const b = req.body || {};
  const n = c.vazioParaNulo;
  const ident = await withUser(req.session.usuario.id_usuario, async (db) => {
    const co = await db.query(
      'SELECT id_corpo, id_desaparecido FROM correspondencia WHERE id_correspondencia = $1',
      [b.id_correspondencia]
    );
    if (!co.rows[0]) throw new ErroHttp(404, 'Correspondência não encontrada.');
    const { rows } = await db.query(
      `INSERT INTO identificacao (id_corpo, id_desaparecido, id_correspondencia, metodo, id_exame,
          id_perito, numero_laudo, data_identificacao, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::DATE, CURRENT_DATE), $9)
       RETURNING *`,
      [co.rows[0].id_corpo, co.rows[0].id_desaparecido, b.id_correspondencia, b.metodo,
       n(b.id_exame), req.session.usuario.id_usuario, n(b.numero_laudo), n(b.data_identificacao),
       n(b.observacoes)]
    );
    return rows[0];
  });
  res.status(201).json(ident);
});

router.post('/liberacoes', exigePerfil('ATENDENTE', 'PERITO'), async (req, res) => {
  const b = req.body || {};
  const n = c.vazioParaNulo;
  const lib = await withUser(req.session.usuario.id_usuario, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO liberacao_corpo (id_corpo, id_familiar, funeraria, numero_certidao_obito,
          destino, id_usuario, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [b.id_corpo, b.id_familiar, n(b.funeraria), n(b.numero_certidao_obito), n(b.destino),
       req.session.usuario.id_usuario, n(b.observacoes)]
    );
    return rows[0];
  });
  res.status(201).json(lib);
});

module.exports = router;
