const express = require('express');
const { query, withUser } = require('../db');
const { ErroHttp } = require('../erros');
const { exigePerfil } = require('../auth');
const c = require('../consultas');

const router = express.Router();

router.get('/desaparecidos', async (req, res) => {
  const { status, q } = req.query;
  const { rows } = await query(
    `SELECT d.id_desaparecido, d.protocolo, d.nome_desaparecido, d.apelido, d.sexo,
            d.data_nascimento, d.idade_desaparecimento, d.altura_cm, d.data_desaparecimento,
            d.status, l.cidade, l.uf,
            COALESCE(EXTRACT(YEAR FROM age(CURRENT_DATE, d.data_nascimento))::INT,
                     d.idade_desaparecimento) AS idade,
            (SELECT count(*) FROM sinal_particular s WHERE s.id_desaparecido = d.id_desaparecido)::INT AS sinais,
            (SELECT max(score_total) FROM correspondencia co
              WHERE co.id_desaparecido = d.id_desaparecido
                AND co.status IN ('SUGERIDA','EM_ANALISE')) AS melhor_score
       FROM registro_desaparecimento d
       LEFT JOIN local l USING (id_local)
      WHERE ($1::TEXT IS NULL OR d.status = $1)
        AND ($2::TEXT IS NULL OR d.nome_desaparecido ILIKE '%' || $2 || '%'
                              OR d.apelido ILIKE '%' || $2 || '%' OR d.protocolo ILIKE '%' || $2 || '%')
      ORDER BY d.data_registro DESC`,
    [status || null, q || null]
  );
  res.json(rows);
});

router.get('/desaparecidos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query(
    `SELECT d.*, l.nome AS local_nome, l.cidade, l.uf, u.nome AS cadastrado_por
       FROM registro_desaparecimento d
       LEFT JOIN local l USING (id_local)
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario_cadastro
      WHERE d.id_desaparecido = $1`,
    [id]
  );
  if (!rows[0]) throw new ErroHttp(404, 'Desaparecido não encontrado. Que ironia.');

  const [familiares, sinais, correspondencias, historico] = await Promise.all([
    query(
      `SELECT f.id_familiar, f.nome, f.cpf, f.telefone, f.email, fd.parentesco, fd.comunicante, fd.doador_dna
         FROM familiar_desaparecido fd JOIN familiar f USING (id_familiar)
        WHERE fd.id_desaparecido = $1 ORDER BY fd.comunicante DESC, f.nome`,
      [id]
    ),
    c.sinaisDoDesaparecido({ query }, id),
    c.correspondenciasDe({ query }, 'id_desaparecido', id),
    c.historico({ query }, 'DESAPARECIMENTO', id),
  ]);

  res.json({
    ...rows[0],
    familiares: familiares.rows,
    sinais,
    correspondencias,
    historico,
  });
});

router.post('/desaparecidos', exigePerfil('ATENDENTE'), async (req, res) => {
  const b = req.body || {};
  const n = c.vazioParaNulo;
  if (!b.familiares || b.familiares.length === 0) {
    throw new ErroHttp(422, 'Registre pelo menos um familiar: alguém precisa ter dado pela falta.');
  }

  const resultado = await withUser(req.session.usuario.id_usuario, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO registro_desaparecimento (
          nome_desaparecido, apelido, cpf_desaparecido, data_nascimento, idade_desaparecimento,
          sexo, altura_cm, peso_kg, cor_pele, cor_cabelo, cor_olhos, tipo_fisico, vestimenta,
          id_local, data_desaparecimento, numero_boletim, circunstancias, id_usuario_cadastro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id_desaparecido, protocolo`,
      [b.nome_desaparecido, n(b.apelido), n(b.cpf_desaparecido), n(b.data_nascimento),
       n(b.idade_desaparecimento), b.sexo, n(b.altura_cm), n(b.peso_kg), n(b.cor_pele),
       n(b.cor_cabelo), n(b.cor_olhos), n(b.tipo_fisico), n(b.vestimenta), n(b.id_local),
       b.data_desaparecimento, n(b.numero_boletim), n(b.circunstancias),
       req.session.usuario.id_usuario]
    );
    const desap = rows[0];

    for (const [i, f] of b.familiares.entries()) {
      // Familiar já cadastrado (mesmo CPF) é reaproveitado
      const fam = await db.query(
        `INSERT INTO familiar (nome, cpf, telefone, email, cidade, uf)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (cpf) DO UPDATE SET telefone = EXCLUDED.telefone
         RETURNING id_familiar`,
        [f.nome, String(f.cpf || '').replace(/\D/g, ''), f.telefone, n(f.email), n(f.cidade), n(f.uf)]
      );
      await db.query(
        `INSERT INTO familiar_desaparecido (id_familiar, id_desaparecido, parentesco, comunicante, doador_dna)
         VALUES ($1, $2, $3, $4, $5)`,
        [fam.rows[0].id_familiar, desap.id_desaparecido, f.parentesco,
         f.comunicante ?? i === 0, !!f.doador_dna]
      );
    }

    await c.inserirSinais(db, b.sinais, { idDesaparecido: desap.id_desaparecido });

    // Rotina da seção 7: cruzar a cada novo cadastro
    const cruz = await db.query('SELECT fn_gerar_correspondencias() AS novas');
    return { ...desap, novas_correspondencias: cruz.rows[0].novas };
  });

  res.status(201).json(resultado);
});

// Desfechos sem corpo: pessoa encontrada viva ou caso arquivado
router.patch('/desaparecidos/:id/status', exigePerfil('ATENDENTE', 'INVESTIGADOR'), async (req, res) => {
  const { status, observacao } = req.body || {};
  if (!['LOCALIZADO_VIVO', 'ENCERRADO'].includes(status)) {
    throw new ErroHttp(422, 'Por aqui só dá para marcar LOCALIZADO_VIVO ou ENCERRADO.');
  }
  const linha = await withUser(
    req.session.usuario.id_usuario,
    async (db) => {
      const { rows } = await db.query(
        `UPDATE registro_desaparecimento SET status = $1
          WHERE id_desaparecido = $2 AND status IN ('ATIVO','EM_ANALISE')
          RETURNING id_desaparecido, status`,
        [status, req.params.id]
      );
      if (!rows[0]) throw new ErroHttp(422, 'Este registro já não está ativo.');
      // As sugestões abertas para essa pessoa deixam de fazer sentido
      await db.query(
        `UPDATE correspondencia SET status = 'DESCARTADA', justificativa = $2
          WHERE id_desaparecido = $1 AND status IN ('SUGERIDA','EM_ANALISE')`,
        [req.params.id, `Descartada: desaparecido marcado como ${status}`]
      );
      return rows[0];
    },
    observacao
  );
  res.json(linha);
});

module.exports = router;
