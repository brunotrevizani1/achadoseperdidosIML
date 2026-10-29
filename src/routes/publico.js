// Rotas abertas ao público: mural, "Eu conheço / é meu"
const express = require('express');
const { query, withUser } = require('../db');
const { ErroHttp } = require('../erros');

const router = express.Router();

const SEXO = { M: 'Homem', F: 'Mulher', I: 'Pessoa' };

// Corpo aparece no mural assim que cadastrado, enquanto continua sem identificação
const CORPO_PUBLICADO = `c.status = 'NAO_IDENTIFICADO'`;

const faixaIdade = (min, max) => {
  if (min == null && max == null) return null;
  return min === max ? `${min} anos` : `${min ?? '?'} a ${max ?? '?'} anos`;
};

const tituloCorpo = (c) =>
  [`${SEXO[c.sexo]} não identificad${c.sexo === 'M' ? 'o' : 'a'}`, faixaIdade(c.idade_estimada_min, c.idade_estimada_max)]
    .filter(Boolean).join(', ');

// Só características gerais: nada de gaveta, boletim ou observações internas
const resumoCorpo = (c) => ({
  tipo: 'corpo',
  id: c.id_corpo,
  codigo: c.codigo_iml,
  titulo: tituloCorpo(c),
  sexo: c.sexo,
  idade: faixaIdade(c.idade_estimada_min, c.idade_estimada_max),
  altura_cm: c.altura_estimada_cm,
  cor_pele: c.cor_pele,
  cor_cabelo: c.cor_cabelo,
  cor_olhos: c.cor_olhos,
  caracteristicas: c.caracteristicas,
  local: c.local_nome,
  bairro: c.bairro,
  cidade: c.cidade,
  uf: c.uf,
  data_encontrado: c.data_encontrado,
});

const SQL_CORPO = `
  SELECT c.*, l.nome AS local_nome, l.bairro, l.cidade, l.uf
    FROM corpo c JOIN local l USING (id_local)`;

const SQL_OBJETO = `
  SELECT o.*, l.nome AS local_nome, l.bairro, l.cidade, l.uf
    FROM objeto o JOIN local l USING (id_local)`;

const resumoObjeto = (o) => ({
  tipo: 'objeto',
  id: o.id_objeto,
  codigo: o.codigo,
  categoria: o.tipo,
  titulo: o.titulo,
  descricao: o.descricao,
  local: o.local_nome,
  bairro: o.bairro,
  cidade: o.cidade,
  uf: o.uf,
  data_encontrado: o.data_encontrado,
});

// Mural: objetos e corpos não identificados, com busca e filtros
router.get('/mural', async (req, res) => {
  const { tipo = '', q = '', categoria = '', cidade = '', sexo = '' } = req.query;
  const busca = `%${String(q).trim()}%`;
  const itens = [];

  if (tipo !== 'corpo') {
    const params = [];
    const where = [`o.status = 'EM_GUARDA'`];
    if (q) { params.push(busca); where.push(`(o.titulo ILIKE $${params.length} OR o.descricao ILIKE $${params.length})`); }
    if (categoria) { params.push(categoria); where.push(`o.tipo = $${params.length}`); }
    if (cidade) { params.push(cidade); where.push(`l.cidade = $${params.length}`); }
    const { rows } = await query(`${SQL_OBJETO} WHERE ${where.join(' AND ')}`, params);
    itens.push(...rows.map(resumoObjeto));
  }

  if (tipo !== 'objeto' && !categoria) {
    const params = [];
    const where = [CORPO_PUBLICADO];
    if (q) {
      params.push(busca);
      where.push(`(c.caracteristicas ILIKE $${params.length} OR l.nome ILIKE $${params.length} OR l.cidade ILIKE $${params.length})`);
    }
    if (cidade) { params.push(cidade); where.push(`l.cidade = $${params.length}`); }
    if (sexo) { params.push(sexo); where.push(`c.sexo = $${params.length}`); }
    const { rows } = await query(`${SQL_CORPO} WHERE ${where.join(' AND ')}`, params);
    itens.push(...rows.map(resumoCorpo));
  }

  itens.sort((a, b) => String(b.data_encontrado).localeCompare(String(a.data_encontrado)));
  res.json(itens);
});

router.get('/mural/filtros', async (req, res) => {
  const { rows } = await query('SELECT DISTINCT cidade FROM local ORDER BY cidade');
  res.json({ cidades: rows.map((r) => r.cidade) });
});

router.get('/mural/objetos/:id', async (req, res) => {
  const { rows } = await query(`${SQL_OBJETO} WHERE o.id_objeto = $1 AND o.status = 'EM_GUARDA'`, [req.params.id]);
  if (!rows[0]) throw new ErroHttp(404, 'Este objeto não está mais no mural (talvez já tenha sido devolvido).');
  res.json(resumoObjeto(rows[0]));
});

router.get('/mural/corpos/:id', async (req, res) => {
  const { rows } = await query(`${SQL_CORPO} WHERE c.id_corpo = $1 AND ${CORPO_PUBLICADO}`, [req.params.id]);
  if (!rows[0]) throw new ErroHttp(404, 'Esta ficha não está no mural.');
  res.json(resumoCorpo(rows[0]));
});

// "Eu conheço / é meu" — limite simples por IP para não virar caixa de spam
const envios = new Map();
function limitaEnvios(req) {
  const agora = Date.now();
  const recentes = (envios.get(req.ip) || []).filter((t) => agora - t < 60 * 60 * 1000);
  if (recentes.length >= 10) throw new ErroHttp(429, 'Muitos envios seguidos. Tente de novo mais tarde.');
  recentes.push(agora);
  envios.set(req.ip, recentes);
}

router.post('/manifestacoes', async (req, res) => {
  limitaEnvios(req);
  const { tipo, id, nome, contato, parentesco, o_que_reconheceu } = req.body || {};
  const campo = (v) => String(v ?? '').trim();
  if (!['objeto', 'corpo'].includes(tipo) || !Number.isInteger(Number(id))) throw new ErroHttp(422, 'Item inválido.');
  if (!campo(nome) || !campo(contato) || !campo(parentesco) || !campo(o_que_reconheceu)) {
    throw new ErroHttp(422, 'Preencha nome, contato, parentesco e o que você reconheceu.');
  }

  if (tipo === 'corpo') {
    const { rows } = await query(`SELECT 1 FROM corpo c WHERE c.id_corpo = $1 AND ${CORPO_PUBLICADO}`, [id]);
    if (!rows[0]) throw new ErroHttp(404, 'Esta ficha não está no mural.');
  }

  await withUser(null, (db) =>
    db.query(
      `INSERT INTO manifestacao (id_objeto, id_corpo, nome, contato, parentesco, o_que_reconheceu)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tipo === 'objeto' ? id : null, tipo === 'corpo' ? id : null, campo(nome), campo(contato),
       campo(parentesco), campo(o_que_reconheceu)]
    )
  );
  res.status(201).json({ ok: true });
});

module.exports = router;
