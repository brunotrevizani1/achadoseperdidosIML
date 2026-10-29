// Cliente da API REST do backend

export class ErroApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

async function requisicao(metodo, url, corpo) {
  const resp = await fetch('/api' + url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
    credentials: 'same-origin',
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401 && url !== '/login' && url !== '/me') {
      window.dispatchEvent(new CustomEvent('sessao-expirada'));
    }
    throw new ErroApi(resp.status, dados.erro || `Erro ${resp.status}`);
  }
  return dados;
}

export const api = {
  get: (url) => requisicao('GET', url),
  post: (url, corpo) => requisicao('POST', url, corpo || {}),
  patch: (url, corpo) => requisicao('PATCH', url, corpo || {}),
  delete: (url) => requisicao('DELETE', url),
};


// Locais mudam pouco: guardados após a primeira carga
let locais = null;
export async function carregarLocais(forcar = false) {
  if (!locais || forcar) locais = await api.get('/admin/locais');
  return locais;
}
