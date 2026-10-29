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

app.use('/api', require('./routes/auth'));
app.use('/api', exigeLogin);
app.use('/api', require('./routes/dominios'));
app.use('/api', require('./routes/painel'));
app.use('/api', require('./routes/desaparecidos'));
app.use('/api', require('./routes/corpos'));
app.use('/api', require('./routes/investigacao'));

app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não identificada. Encaminhada para a perícia.' });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Erros do banco viram mensagens legíveis
app.use((err, req, res, next) => {
  const { status, mensagem, regra } = traduzErro(err);
  res.status(status).json({ erro: mensagem, regra });
});

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => {
  console.log(`Achados e Perdidos do IML rodando em http://localhost:${porta}`);
});
