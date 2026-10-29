const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { ErroHttp } = require('../erros');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  const { rows } = await query(
    'SELECT id_usuario, nome, email, senha_hash FROM usuario WHERE email = $1 AND ativo',
    [String(email || '').trim().toLowerCase()]
  );
  const usuario = rows[0];
  if (!usuario || !(await bcrypt.compare(String(senha || ''), usuario.senha_hash))) {
    throw new ErroHttp(401, 'Acesso recusado: e-mail ou senha não conferem.');
  }
  delete usuario.senha_hash;
  req.session.usuario = usuario;
  res.json(usuario);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.usuario) throw new ErroHttp(401, 'Não autenticado.');
  res.json(req.session.usuario);
});

module.exports = router;
