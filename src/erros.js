// Traduz os erros do PostgreSQL (CHECK, UNIQUE, triggers) em mensagens para a tela.

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Nomes gerados automaticamente pelo PostgreSQL para as restrições do 01_schema.sql
const RESTRICOES = {
  manifestacao_check: 'Aceitar ou recusar uma manifestação exige parecer.',
  manifestacao_check1: 'Aceitar ou recusar uma manifestação exige parecer.',
  corpo_check: 'A idade mínima estimada não pode ser maior que a máxima.',
  corpo_codigo_iml_key: 'Já existe um corpo com esse código IML.',
  objeto_codigo_key: 'Já existe um objeto com esse código.',
  usuario_email_key: 'Já existe um usuário com esse e-mail.',
};

const POR_CODIGO = {
  '23502': (e) => `Campo obrigatório não preenchido: ${e.column}.`,
  '23503': () => 'Referência inválida: o registro relacionado não existe.',
  '23505': () => 'Registro duplicado.',
  '23514': (e) => `Valor fora das regras do banco (${e.constraint}).`,
  '22P02': () => 'Valor em formato inválido.',
  '22007': () => 'Data em formato inválido.',
  '22008': () => 'Data fora do intervalo permitido.',
  '22001': () => 'Texto maior que o tamanho permitido.',
  P0001: (e) => e.message, // RAISE EXCEPTION dos triggers de 02_logica.sql
};

function traduzErro(err) {
  if (err instanceof ErroHttp) return { status: err.status, mensagem: err.message };
  if (err.type === 'entity.too.large') return { status: 413, mensagem: 'Arquivo grande demais.' };
  if (err.constraint && RESTRICOES[err.constraint]) {
    return { status: 422, mensagem: RESTRICOES[err.constraint], regra: err.constraint };
  }
  if (err.code && POR_CODIGO[err.code]) {
    return { status: 422, mensagem: POR_CODIGO[err.code](err), regra: err.constraint };
  }
  if (err.code === 'ECONNREFUSED' || err.code === '3D000' || err.code === '28P01') {
    return { status: 503, mensagem: 'Sem conexão com o PostgreSQL. Confira o .env e se o serviço está rodando.' };
  }
  console.error(err);
  return { status: 500, mensagem: 'Erro inesperado no servidor.' };
}

module.exports = { ErroHttp, traduzErro };
