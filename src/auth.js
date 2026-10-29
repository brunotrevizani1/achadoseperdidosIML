const { ErroHttp } = require('./erros');

function exigeLogin(req, res, next) {
  if (!req.session.usuario) {
    return next(new ErroHttp(401, 'Passe o crachá primeiro.'));
  }
  next();
}

// ADMIN pode tudo; os demais só o que o perfil permite (seção 1 da especificação)
function exigePerfil(...perfis) {
  return (req, res, next) => {
    const { perfil } = req.session.usuario;
    if (perfil === 'ADMIN' || perfis.includes(perfil)) return next();
    next(new ErroHttp(403, `Seu crachá de ${perfil} não abre essa porta. Precisa ser: ${perfis.join(' ou ')}.`));
  };
}

module.exports = { exigeLogin, exigePerfil };
