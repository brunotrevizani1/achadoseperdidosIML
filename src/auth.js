const { ErroHttp } = require('./erros');

function exigeLogin(req, res, next) {
  if (!req.session.usuario) {
    return next(new ErroHttp(401, 'Acesso restrito à equipe do IML. Entre primeiro.'));
  }
  next();
}

module.exports = { exigeLogin };
