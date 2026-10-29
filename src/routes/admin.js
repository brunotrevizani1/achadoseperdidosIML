// Tela de administrador (IML): objetos, corpos e avaliação das manifestações
const express = require('express');
const { query, withUser } = require('../db');
const { ErroHttp } = require('../erros');

const router = express.Router();
const quem = (req) => req.session.usuario.id_usuario;
const vazio = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const numero = (v) => (vazio(v) === null ? null : Number(v));

// ---------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------
router.get('/painel', async (req, res) => {
  const [objetos, corpos, manifestacoes, pendentes, eventos] = await Promise.all([
    query('SELECT status, count(*)::int AS n FROM objeto GROUP BY status'),
    query('SELECT status, count(*)::int AS n FROM corpo GROUP BY status'),
    query('SELECT status, count(*)::int AS n FROM manifestacao GROUP BY status'),
    query(`SELECT m.id_manifestacao, m.nome, m.parentesco, m.criado_em, m.status,
                  COALESCE(o.titulo, c.codigo_iml) AS item, (m.id_objeto IS NOT NULL) AS e_objeto
             FROM manifestacao m
             LEFT JOIN objeto o ON o.id_objeto = m.id_objeto
             LEFT JOIN corpo c ON c.id_corpo = m.id_corpo
            WHERE m.status IN ('RECEBIDA','EM_ANALISE')
            ORDER BY m.criado_em LIMIT 6`),
    query(`SELECT h.entidade, h.id_registro, h.status_anterior, h.status_novo, h.data_alteracao, h.observacao,
                  u.nome AS usuario,
                  CASE h.entidade WHEN 'OBJETO' THEN (SELECT titulo FROM objeto WHERE id_objeto = h.id_registro)
                                  WHEN 'CORPO'  THEN (SELECT codigo_iml FROM corpo WHERE id_corpo = h.id_registro)
                                  ELSE 'Manifestação #' || h.id_registro END AS rotulo
             FROM historico_status h LEFT JOIN usuario u USING (id_usuario)
            ORDER BY h.data_alteracao DESC, h.id_historico DESC LIMIT 8`),
  ]);
  const mapa = (r) => Object.fromEntries(r.rows.map((x) => [x.status, x.n]));
  res.json({
    objetos: mapa(objetos),
    corpos: mapa(corpos),
    manifestacoes: mapa(manifestacoes),
    pendentes: pendentes.rows,
    eventos: eventos.rows,
  });
});

// ---------------------------------------------------------------------
// Locais
// ---------------------------------------------------------------------
router.get('/locais', async (req, res) => {
  const { rows } = await query('SELECT id_local, nome, tipo_local, bairro, cidade, uf FROM local ORDER BY uf, cidade, nome');
  res.json(rows);
});

router.post('/locais', async (req, res) => {
  const { nome, tipo_local, bairro, cidade, uf } = req.body || {};
  if (!vazio(nome) || !vazio(cidade) || !vazio(uf)) throw new ErroHttp(422, 'Local precisa de nome, cidade e UF.');
  const { rows } = await query(
    `INSERT INTO local (nome, tipo_local, bairro, cidade, uf) VALUES ($1, $2, $3, $4, upper($5))
     RETURNING id_local, nome, tipo_local, bairro, cidade, uf`,
    [nome.trim(), vazio(tipo_local), vazio(bairro), cidade.trim(), uf.trim()]
  );
  res.status(201).json(rows[0]);
});

// ---------------------------------------------------------------------
// Apoio: histórico e manifestações de um item
// ---------------------------------------------------------------------
async function historico(entidade, id) {
  const { rows } = await query(
    `SELECT h.status_anterior, h.status_novo, h.data_alteracao, h.observacao, u.nome AS usuario
       FROM historico_status h LEFT JOIN usuario u USING (id_usuario)
      WHERE h.entidade = $1 AND h.id_registro = $2 ORDER BY h.data_alteracao, h.id_historico`,
    [entidade, id]
  );
  return rows;
}

const manifestacoesDe = async (coluna, id) =>
  (await query(
    `SELECT m.*, u.nome AS avaliador FROM manifestacao m LEFT JOIN usuario u ON u.id_usuario = m.id_usuario_analise
      WHERE m.${coluna} = $1 ORDER BY m.criado_em DESC`, [id]
  )).rows;

// ---------------------------------------------------------------------
// Objetos
// ---------------------------------------------------------------------
const SQL_OBJETOS = `
  SELECT o.*, l.nome AS local_nome, l.cidade, l.uf, c.codigo_iml,
         (SELECT count(*)::int FROM manifestacao m WHERE m.id_objeto = o.id_objeto AND m.status IN ('RECEBIDA','EM_ANALISE')) AS pendentes
    FROM objeto o JOIN local l USING (id_local) LEFT JOIN corpo c ON c.id_corpo = o.id_corpo`;

router.get('/objetos', async (req, res) => {
  const { status } = req.query;
  const { rows } = await query(
    `${SQL_OBJETOS} ${status ? 'WHERE o.status = $1' : ''} ORDER BY o.criado_em DESC`,
    status ? [status] : []
  );
  res.json(rows);
});

router.get('/objetos/:id', async (req, res) => {
  const { rows } = await query(`${SQL_OBJETOS} WHERE o.id_objeto = $1`, [req.params.id]);
  if (!rows[0]) throw new ErroHttp(404, 'Objeto não encontrado.');
  const [manifestacoes, hist] = await Promise.all([
    manifestacoesDe('id_objeto', req.params.id), historico('OBJETO', req.params.id),
  ]);
  res.json({ ...rows[0], manifestacoes, historico: hist });
});

router.post('/objetos', async (req, res) => {
  const b = req.body || {};
  if (!vazio(b.titulo) || !vazio(b.descricao) || !vazio(b.tipo) || !b.id_local || !vazio(b.data_encontrado)) {
    throw new ErroHttp(422, 'Informe tipo, título, descrição, local e data em que foi encontrado.');
  }
  const novo = await withUser(quem(req), async (db) => {
    const { rows } = await db.query(
      `INSERT INTO objeto (tipo, titulo, descricao, id_local, data_encontrado, id_corpo, id_usuario_cadastro)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_objeto, codigo`,
      [b.tipo, b.titulo.trim(), b.descricao.trim(), b.id_local, b.data_encontrado, numero(b.id_corpo), quem(req)]
    );
    return rows[0];
  });
  res.status(201).json(novo);
});

router.patch('/objetos/:id', async (req, res) => {
  const b = req.body || {};
  await withUser(quem(req), (db) =>
    db.query(
      `UPDATE objeto SET tipo = COALESCE($2, tipo), titulo = COALESCE($3, titulo),
              descricao = COALESCE($4, descricao), id_local = COALESCE($5, id_local),
              data_encontrado = COALESCE($6, data_encontrado)
        WHERE id_objeto = $1`,
      [req.params.id, vazio(b.tipo), vazio(b.titulo), vazio(b.descricao), numero(b.id_local), vazio(b.data_encontrado)]
    )
  );
  res.json({ ok: true });
});

// Marca como devolvido (ou reabre, se foi engano)
router.post('/objetos/:id/status', async (req, res) => {
  const { status, observacao } = req.body || {};
  if (!['EM_GUARDA', 'DEVOLVIDO'].includes(status)) throw new ErroHttp(422, 'Status inválido.');
  await withUser(quem(req), (db) => db.query('UPDATE objeto SET status = $2 WHERE id_objeto = $1', [req.params.id, status]), vazio(observacao));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Corpos
// ---------------------------------------------------------------------
const SQL_CORPOS = `
  SELECT c.*, l.nome AS local_nome, l.cidade, l.uf,
         (SELECT count(*)::int FROM manifestacao m WHERE m.id_corpo = c.id_corpo AND m.status IN ('RECEBIDA','EM_ANALISE')) AS pendentes
    FROM corpo c JOIN local l USING (id_local)`;

router.get('/corpos', async (req, res) => {
  const { status } = req.query;
  const { rows } = await query(`${SQL_CORPOS} ${status ? 'WHERE c.status = $1' : ''} ORDER BY c.data_entrada DESC`, status ? [status] : []);
  res.json(rows);
});

router.get('/corpos/:id', async (req, res) => {
  const { rows } = await query(`${SQL_CORPOS} WHERE c.id_corpo = $1`, [req.params.id]);
  if (!rows[0]) throw new ErroHttp(404, 'Corpo não encontrado.');
  const [manifestacoes, hist, objetos] = await Promise.all([
    manifestacoesDe('id_corpo', req.params.id), historico('CORPO', req.params.id),
    query('SELECT id_objeto, codigo, titulo, status FROM objeto WHERE id_corpo = $1 ORDER BY id_objeto', [req.params.id]),
  ]);
  res.json({ ...rows[0], manifestacoes, historico: hist, objetos: objetos.rows });
});

router.post('/corpos', async (req, res) => {
  const b = req.body || {};
  if (!['M', 'F', 'I'].includes(b.sexo) || !b.id_local || !vazio(b.data_encontrado)) {
    throw new ErroHttp(422, 'Informe sexo, local e data em que o corpo foi encontrado.');
  }
  const novo = await withUser(quem(req), async (db) => {
    const { rows } = await db.query(
      `INSERT INTO corpo (sexo, idade_estimada_min, idade_estimada_max, altura_estimada_cm, cor_pele, cor_cabelo,
                          cor_olhos, caracteristicas, observacoes, id_local, data_encontrado, gaveta_camara,
                          id_usuario_cadastro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id_corpo, codigo_iml`,
      [b.sexo, numero(b.idade_estimada_min), numero(b.idade_estimada_max), numero(b.altura_estimada_cm),
       vazio(b.cor_pele), vazio(b.cor_cabelo), vazio(b.cor_olhos), vazio(b.caracteristicas), vazio(b.observacoes),
       b.id_local, b.data_encontrado, vazio(b.gaveta_camara), quem(req)]
    );
    return rows[0];
  });
  res.status(201).json(novo);
});

router.patch('/corpos/:id', async (req, res) => {
  const b = req.body || {};
  await withUser(quem(req), (db) =>
    db.query(
      `UPDATE corpo SET idade_estimada_min = $2, idade_estimada_max = $3, altura_estimada_cm = $4,
              cor_pele = $5, cor_cabelo = $6, cor_olhos = $7, caracteristicas = $8, observacoes = $9,
              gaveta_camara = $10
        WHERE id_corpo = $1`,
      [req.params.id, numero(b.idade_estimada_min), numero(b.idade_estimada_max), numero(b.altura_estimada_cm),
       vazio(b.cor_pele), vazio(b.cor_cabelo), vazio(b.cor_olhos), vazio(b.caracteristicas), vazio(b.observacoes),
       vazio(b.gaveta_camara)]
    )
  );
  res.json({ ok: true });
});

router.post('/corpos/:id/status', async (req, res) => {
  const { status, observacao } = req.body || {};
  if (!['NAO_IDENTIFICADO', 'IDENTIFICADO'].includes(status)) throw new ErroHttp(422, 'Status inválido.');
  await withUser(quem(req), (db) => db.query('UPDATE corpo SET status = $2 WHERE id_corpo = $1', [req.params.id, status]), vazio(observacao));
  res.json({ ok: true });
});

// Exclui o item de vez: manifestações e histórico saem junto
async function excluirItem(req, res, { tabela, coluna, entidade, nome }) {
  const id = req.params.id;
  await withUser(quem(req), async (db) => {
    await db.query(
      `DELETE FROM historico_status WHERE (entidade = '${entidade}' AND id_registro = $1)
          OR (entidade = 'MANIFESTACAO' AND id_registro IN (SELECT id_manifestacao FROM manifestacao WHERE ${coluna} = $1))`, [id]);
    const r = await db.query(`DELETE FROM ${tabela} WHERE ${coluna} = $1`, [id]);
    if (!r.rowCount) throw new ErroHttp(404, `${nome} não encontrado.`);
  });
  res.json({ ok: true });
}

router.delete('/objetos/:id', (req, res) =>
  excluirItem(req, res, { tabela: 'objeto', coluna: 'id_objeto', entidade: 'OBJETO', nome: 'Objeto' }));
router.delete('/corpos/:id', (req, res) =>
  excluirItem(req, res, { tabela: 'corpo', coluna: 'id_corpo', entidade: 'CORPO', nome: 'Corpo' }));

// ---------------------------------------------------------------------
// Manifestações do público
// ---------------------------------------------------------------------
router.get('/manifestacoes', async (req, res) => {
  const { status } = req.query;
  const { rows } = await query(
    `SELECT m.*, (m.id_objeto IS NOT NULL) AS e_objeto, COALESCE(o.titulo, c.codigo_iml) AS item,
            COALESCE(o.codigo, c.codigo_iml) AS codigo_item, u.nome AS avaliador
       FROM manifestacao m
       LEFT JOIN objeto o ON o.id_objeto = m.id_objeto
       LEFT JOIN corpo c ON c.id_corpo = m.id_corpo
       LEFT JOIN usuario u ON u.id_usuario = m.id_usuario_analise
      ${status ? 'WHERE m.status = $1' : ''}
      ORDER BY (m.status IN ('RECEBIDA','EM_ANALISE')) DESC, m.criado_em`,
    status ? [status] : []
  );
  res.json(rows);
});

// decisão: EM_ANALISE | ACEITA (devolve o objeto / identifica o corpo) | RECUSADA
router.post('/manifestacoes/:id/avaliar', async (req, res) => {
  const { decisao, parecer } = req.body || {};
  if (!['EM_ANALISE', 'ACEITA', 'RECUSADA'].includes(decisao)) throw new ErroHttp(422, 'Decisão inválida.');
  if (decisao !== 'EM_ANALISE' && !vazio(parecer)) throw new ErroHttp(422, 'Aceitar ou recusar exige parecer.');
  await withUser(
    quem(req),
    (db) => db.query('UPDATE manifestacao SET status = $2, parecer = COALESCE($3, parecer) WHERE id_manifestacao = $1',
      [req.params.id, decisao, vazio(parecer)]),
    vazio(parecer)
  );
  res.json({ ok: true });
});

module.exports = router;
