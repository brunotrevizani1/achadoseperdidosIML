const express = require('express');
const { query, withUser } = require('../db');
const { ErroHttp } = require('../erros');

const router = express.Router();

router.get('/dominios', async (req, res) => {
  const [tipos, regioes, locais, causas] = await Promise.all([
    query('SELECT id_tipo_sinal, descricao FROM tipo_sinal ORDER BY id_tipo_sinal'),
    query('SELECT id_regiao, descricao FROM regiao_corpo ORDER BY id_regiao'),
    query('SELECT id_local, nome, tipo_local, bairro, cidade, uf FROM local ORDER BY uf, cidade, nome'),
    query('SELECT id_causa, codigo_cid, descricao, categoria FROM causa_morte ORDER BY id_causa'),
  ]);
  res.json({
    tipos_sinal: tipos.rows,
    regioes: regioes.rows,
    locais: locais.rows,
    causas: causas.rows,
  });
});

router.post('/locais', async (req, res) => {
  const { nome, tipo_local, logradouro, bairro, cidade, uf } = req.body || {};
  if (!nome || !cidade || !uf) throw new ErroHttp(422, 'Local precisa de nome, cidade e UF.');
  const local = await withUser(req.session.usuario.id_usuario, async (db) => {
    const { rows } = await db.query(
      `INSERT INTO local (nome, tipo_local, logradouro, bairro, cidade, uf)
       VALUES ($1, $2, $3, $4, $5, upper($6))
       RETURNING id_local, nome, tipo_local, bairro, cidade, uf`,
      [nome, tipo_local || null, logradouro || null, bairro || null, cidade, uf]
    );
    return rows[0];
  });
  res.status(201).json(local);
});

module.exports = router;
