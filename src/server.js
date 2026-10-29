require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const { traduzErro } = require('./erros');
const { exigeLogin } = require('./auth');

const app = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'iml-segredo-de-desenvolvimento',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }, // um plantão
  })
);

// Público
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/publico'));

// Restrito à equipe do IML
app.use('/api/admin', exigeLogin, require('./routes/admin'));

app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// three.js (a barraca em 3D) servido do próprio node_modules, sem CDN
const three = path.join(__dirname, '..', 'node_modules', 'three');
app.use('/vendor/three', express.static(path.join(three, 'build')));
app.use('/vendor/three-addons', express.static(path.join(three, 'examples', 'jsm')));

// Erros do banco viram mensagens legíveis
app.use((err, req, res, next) => {
  const { status, mensagem, regra } = traduzErro(err);
  res.status(status).json({ erro: mensagem, regra });
});

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => {
  console.log(`Achados e Perdidos do IML rodando em http://localhost:${porta}`);
});
