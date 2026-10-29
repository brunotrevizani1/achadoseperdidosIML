const express = require('express');
const { query, withUser } = require('../db');
const { ErroHttp } = require('../erros');
const { exigePerfil } = require('../auth');
const c = require('../consultas');

const router = express.Router();

router.get('/corpos', async (req, res) => {
  const { status } = req.query;
  const { rows } = await query(
    `SELECT c.id_corpo, c.codigo_iml, c.sexo, c.idade_estimada_min, c.idade_estimada_max,
            c.altura_estimada_cm, c.estado_conservacao, c.gaveta_camara, c.status, c.data_entrada,
            e.data_encontrado, l.nome AS local_nome, l.cidade, l.uf,
            (SELECT count(*) FROM sinal_particular s WHERE s.id_corpo = c.id_corpo)::INT AS sinais,
            (SELECT max(score_total) FROM correspondencia co
              WHERE co.id_corpo = c.id_corpo AND co.status IN ('SUGERIDA','EM_ANALISE')) AS melhor_score
       FROM corpo c
       LEFT JOIN registro_entrada e USING (id_corpo)
       LEFT JOIN local l ON l.id_local = e.id_local
      WHERE ($1::TEXT IS NULL OR c.status = $1)
      ORDER BY c.data_entrada DESC`,
    [status || null]
  );
  res.json(rows);
});

// Gavetas ocupadas (para sugerir uma livre no check-in)
router.get('/gavetas', async (req, res) => {
  const { rows } = await query(
    `SELECT gaveta_camara FROM corpo
      WHERE gaveta_camara IS NOT NULL
        AND status IN ('AGUARDANDO_IDENTIFICACAO','EM_ANALISE','IDENTIFICADO')`
  );
  res.json(rows.map((r) => r.gaveta_camara));
});

router.get('/corpos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(
    `SELECT c.*, u.nome AS cadastrado_por,
            e.data_encontrado, e.data_obito_estimada, e.orgao_remocao, e.responsavel_remocao,
            e.numero_boletim, e.circunstancias,
            l.nome AS local_nome, l.cidade, l.uf, l.tipo_local,
            cm.descricao AS causa_presumida
       FROM corpo c
       LEFT JOIN usuario u ON u.id_usuario = c.id_usuario_cadastro
       LEFT JOIN registro_entrada e USING (id_corpo)
       LEFT JOIN local l ON l.id_local = e.id_local
       LEFT JOIN causa_morte cm ON cm.id_causa = e.id_causa_presumida
      WHERE c.id_corpo = $1`,
    [id]
  );
  if (!rows[0]) throw new ErroHttp(404, 'Corpo não encontrado. Isso é preocupante.');

  const [sinais, exames, correspondencias, historico, identificacao, liberacao] = await Promise.all([
    c.sinaisDoCorpo({ query }, id),
    query(
      `SELECT x.*, u.nome AS perito, cm.descricao AS causa
         FROM exame_pericial x
         LEFT JOIN usuario u ON u.id_usuario = x.id_perito
         LEFT JOIN causa_morte cm ON cm.id_causa = x.id_causa
        WHERE x.id_corpo = $1 ORDER BY x.data_solicitacao`,
      [id]
    ),
    c.correspondenciasDe({ query }, 'id_corpo', id),
    c.historico({ query }, 'CORPO', id),
    query(
      `SELECT i.*, d.nome_desaparecido, u.nome AS perito
         FROM identificacao i
         JOIN registro_desaparecimento d USING (id_desaparecido)
         JOIN usuario u ON u.id_usuario = i.id_perito
        WHERE i.id_corpo = $1`,
      [id]
    ),
    query(
      `SELECT lb.*, f.nome AS familiar, u.nome AS liberado_por
         FROM liberacao_corpo lb
         JOIN familiar f USING (id_familiar)
         JOIN usuario u ON u.id_usuario = lb.id_usuario
        WHERE lb.id_corpo = $1`,
      [id]
    ),
  ]);

  res.json({
    ...rows[0],
    sinais,
    exames: exames.rows,
    correspondencias,
    historico,
    identificacao: identificacao.rows[0] || null,
    liberacao: liberacao.rows[0] || null,
  });
});

router.post('/corpos', exigePerfil('PERITO'), async (req, res) => {
  const b = req.body || {};
  const n = c.vazioParaNulo;
  if (!b.id_local || !b.data_encontrado) {
    throw new ErroHttp(422, 'Informe onde e quando o corpo foi encontrado.');
  }

  const resultado = await withUser(req.session.usuario.id_usuario, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm,
          peso_estimado_kg, cor_pele, cor_cabelo, cor_olhos, estado_conservacao, vestimenta,
          pertences, gaveta_camara, id_usuario_cadastro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id_corpo, codigo_iml, gaveta_camara`,
      [b.sexo, n(b.idade_estimada_min), n(b.idade_estimada_max), n(b.altura_estimada_cm),
       n(b.peso_estimado_kg), n(b.cor_pele), n(b.cor_cabelo), n(b.cor_olhos),
       n(b.estado_conservacao), n(b.vestimenta), n(b.pertences), n(b.gaveta_camara),
       req.session.usuario.id_usuario]
    );
    const corpo = rows[0];

    await db.query(
      `INSERT INTO registro_entrada (id_corpo, id_local, id_causa_presumida, data_encontrado,
          data_obito_estimada, orgao_remocao, responsavel_remocao, numero_boletim, circunstancias)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [corpo.id_corpo, b.id_local, n(b.id_causa_presumida), b.data_encontrado,
       n(b.data_obito_estimada), n(b.orgao_remocao), n(b.responsavel_remocao),
       n(b.numero_boletim), n(b.circunstancias)]
    );

    await c.inserirSinais(db, b.sinais, { idCorpo: corpo.id_corpo });

    const cruz = await db.query('SELECT fn_gerar_correspondencias() AS novas');
    return { ...corpo, novas_correspondencias: cruz.rows[0].novas };
  });

  res.status(201).json(resultado);
});

router.post('/corpos/:id/exames', exigePerfil('PERITO'), async (req, res) => {
  const b = req.body || {};
  const n = c.vazioParaNulo;
  const exame = await withUser(req.session.usuario.id_usuario, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO exame_pericial (id_corpo, tipo_exame, id_perito, numero_laudo, data_realizacao,
          id_causa, resultado, conclusao, status)
       VALUES ($1,$2,$3,$4,
               COALESCE($5::DATE, CASE WHEN $9::TEXT = 'CONCLUIDO' THEN CURRENT_DATE END),
               $6,$7,$8,$9)
       RETURNING *`,
      [req.params.id, b.tipo_exame, req.session.usuario.id_usuario, n(b.numero_laudo),
       n(b.data_realizacao), n(b.id_causa), n(b.resultado), n(b.conclusao), b.status || 'CONCLUIDO']
    );
    return rows[0];
  });
  res.status(201).json(exame);
});

module.exports = router;
