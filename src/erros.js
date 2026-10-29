// Traduz os erros do PostgreSQL (CHECK, UNIQUE, triggers) em mensagens para a tela.

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Nomes gerados automaticamente pelo PostgreSQL para as restrições do 01_schema.sql
const RESTRICOES = {
  correspondencia_check: 'Descartar ou confirmar exige justificativa. Nem no IML a gente decide no "achismo".',
  sinal_particular_check: 'Um sinal pertence a um corpo OU a um desaparecido, nunca aos dois.',
  foto_registro_check: 'Uma foto pertence a um corpo OU a um desaparecido, nunca aos dois.',
  registro_desaparecimento_check: 'Informe a data de nascimento ou a idade. Chutar "uns 30 e poucos" não vale.',
  corpo_check: 'A idade mínima estimada não pode ser maior que a máxima. A perícia é boa, mas não viaja no tempo.',
  exame_pericial_check: 'O exame não pode ser realizado antes de ser solicitado.',
  identificacao_id_corpo_key: 'Este corpo já foi identificado. Ninguém tem duas identidades por aqui.',
  identificacao_id_desaparecido_key: 'Esta pessoa já foi identificada em outro corpo.',
  liberacao_corpo_id_corpo_key: 'Este corpo já foi liberado.',
  correspondencia_id_corpo_id_desaparecido_key: 'Esse par já existe no cruzamento.',
  registro_desaparecimento_protocolo_key: 'Já existe um registro com esse protocolo.',
  corpo_codigo_iml_key: 'Já existe um corpo com esse código IML.',
  exame_pericial_numero_laudo_key: 'Já existe um exame com esse número de laudo.',
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
