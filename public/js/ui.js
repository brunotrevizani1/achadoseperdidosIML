// Utilitários de interface: templates, rótulos, toasts, modais e efeitos

// ---------------------------------------------------------------------
// Template HTML com escape automático
// ---------------------------------------------------------------------
class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
export const raw = (s) => new Raw(String(s ?? ''));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function valor(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(valor).join('');
  return esc(v);
}

export function html(partes, ...valores) {
  let out = partes[0];
  for (let i = 0; i < valores.length; i++) out += valor(valores[i]) + partes[i + 1];
  return new Raw(out);
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

// ---------------------------------------------------------------------
// Rótulos dos valores do banco
// ---------------------------------------------------------------------
export const ROTULOS = {
  EM_GUARDA: 'Em guarda',
  DEVOLVIDO: 'Devolvido',
  NAO_IDENTIFICADO: 'Não identificado',
  IDENTIFICADO: 'Identificado',
  RECEBIDA: 'Recebida',
  EM_ANALISE: 'Em análise',
  ACEITA: 'Aceita',
  RECUSADA: 'Recusada',
  CELULAR: 'Celular',
  DOCUMENTO: 'Documento',
  ALIANCA: 'Aliança',
  MOCHILA: 'Mochila',
  CARTEIRA: 'Carteira',
  JOIA: 'Joia / relógio',
  ROUPA: 'Roupa',
  CHAVES: 'Chaves',
  OCULOS: 'Óculos',
  RELOGIO: 'Relógio',
  CALCADO: 'Calçado',
  BONE: 'Boné',
  FONE: 'Fone de ouvido',
  GUARDA_CHUVA: 'Guarda-chuva',
  BOLSA: 'Bolsa',
  NOTEBOOK: 'Notebook',
  OUTRO: 'Outro',
  MAE: 'Mãe',
  IRMAO: 'Irmão',
  IRMA: 'Irmã',
  CONJUGE: 'Cônjuge',
  AVO: 'Avô/Avó',
  VIA_PUBLICA: 'Via pública',
  RESIDENCIA: 'Residência',
  RIO_LAGO: 'Rio / lago',
  MATA: 'Mata',
  HOSPITAL: 'Hospital',
  RODOVIA: 'Rodovia',
  ESTABELECIMENTO: 'Estabelecimento',
  BRACO_D: 'Braço direito',
  BRACO_E: 'Braço esquerdo',
  PERNA_D: 'Perna direita',
  PERNA_E: 'Perna esquerda',
  PEITO: 'Peito',
  ABDOME: 'Abdômen',
  COSTAS: 'Costas',
  PESCOCO: 'Pescoço',
  TRIBAL: 'Tribal',
  FLORAL: 'Floral',
  GEOMETRICO: 'Geométrica',
  CHAMAS: 'Chamas',
  ESTRELAS: 'Estrelas',
};
export const rotulo = (v) =>
  ROTULOS[v] || (v ? String(v).charAt(0) + String(v).slice(1).replaceAll('_', ' ').toLowerCase() : '—');

export const TIPOS_OBJETO = ['CELULAR', 'DOCUMENTO', 'ALIANCA', 'MOCHILA', 'CARTEIRA', 'JOIA', 'ROUPA', 'CHAVES',
  'OCULOS', 'RELOGIO', 'CALCADO', 'BONE', 'FONE', 'GUARDA_CHUVA', 'BOLSA', 'NOTEBOOK', 'OUTRO'];
export const PARENTESCOS = ['CONJUGE', 'PAI', 'MAE', 'FILHO', 'FILHA', 'IRMAO', 'IRMA', 'AVO', 'NETO',
  'TIO', 'SOBRINHO', 'PRIMO', 'AMIGO', 'VIZINHO', 'OUTRO'];
export const TIPOS_LOCAL = ['VIA_PUBLICA', 'RESIDENCIA', 'RIO_LAGO', 'MATA', 'HOSPITAL', 'RODOVIA',
  'ESTABELECIMENTO', 'OUTRO'];
export const SEXO = { M: 'Masculino', F: 'Feminino', I: 'Indeterminado' };
// Opções do cadastro de aparência (o boneco 3D entende estes nomes)
export const COR_PELE = ['Branca', 'Parda', 'Negra', 'Amarela', 'Indígena'];
export const COR_CABELO = ['Preto', 'Castanho', 'Loiro', 'Ruivo', 'Grisalho', 'Branco', 'Careca'];
export const TAMANHO_CABELO = ['Curto', 'Longo'];
export const COR_OLHOS = ['Castanhos', 'Pretos', 'Azuis', 'Verdes', 'Mel', 'Cinzentos'];
export const LOCAIS_TATUAGEM = ['BRACO_D', 'BRACO_E', 'PERNA_D', 'PERNA_E', 'PEITO', 'ABDOME', 'COSTAS', 'PESCOCO'];
export const ESTILOS_TATUAGEM = ['TRIBAL', 'FLORAL', 'GEOMETRICO', 'CHAMAS', 'ESTRELAS'];
// "BRACO_D:FLORAL,PEITO" -> "Braço direito (Floral), Peito (Tribal)"
export const rotuloTatuagens = (v) => String(v || '').split(',').filter(Boolean).map((tok) => {
  const [local, estilo] = tok.split(':');
  return `${rotulo(local)} (${rotulo(estilo || 'TRIBAL')})`;
}).join(', ');

export const chip = (status) => html`<span class="chip chip--${(status || '').toLowerCase()}">${rotulo(status)}</span>`;

export const opcoes = (lista, selecionado, rot = rotulo) =>
  lista.map((v) => html`<option value="${v}" ${raw(v === selecionado ? 'selected' : '')}>${rot(v)}</option>`);

// ---------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------
export function data(v) {
  if (!v) return '—';
  const [a, m, d] = String(v).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
export function dataHora(v) {
  if (!v) return '—';
  const d = new Date(v);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------
// Toasts e modais
// ---------------------------------------------------------------------
export function toast(mensagem, tipo = 'info', ms = 4200) {
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  el.textContent = mensagem;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('saindo'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export const erroBanco = (e) => toast(e.message, 'erro', 6500);

// Abre um modal com formulário; resolve com os dados (FormData -> objeto) ou null se cancelar
export function modalForm({ titulo, corpo, confirmar = 'Salvar', classe = '' }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = `modal ${classe}`;
    dlg.innerHTML = String(html`
      <form method="dialog" class="modal__form">
        <header class="modal__topo"><h2>${titulo}</h2>
          <button type="button" class="btn-icone" data-fechar aria-label="Fechar">✕</button></header>
        <div class="modal__corpo">${corpo}</div>
        <footer class="modal__acoes">
          <button type="button" class="btn btn--fantasma" data-fechar>Cancelar</button>
          <button type="submit" class="btn btn--primario">${confirmar}</button>
        </footer>
      </form>`);
    document.body.append(dlg);
    const form = $('form', dlg);
    let resultado = null;
    form.addEventListener('submit', () => {
      if (!form.checkValidity()) return;
      resultado = Object.fromEntries(new FormData(form));
    });
    $$('[data-fechar]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(resultado);
    });
    dlg.showModal();
    $('input, select, textarea', dlg)?.focus();
  });
}

export function linhaDoTempo(eventos) {
  if (!eventos?.length) return html`<p class="vazio">Nada registrado ainda.</p>`;
  return html`<ol class="timeline">
    ${eventos.map(
      (e) => html`<li>
        <span class="timeline__ponto"></span>
        <div>
          <div class="timeline__topo">${e.status_anterior ? html`${chip(e.status_anterior)} <span aria-hidden="true">→</span> ` : ''}${chip(e.status_novo)}</div>
          <div class="timeline__meta">${dataHora(e.data_alteracao)}${e.usuario ? ` · ${e.usuario}` : ''}</div>
          ${e.observacao ? html`<div class="timeline__obs">“${e.observacao}”</div>` : ''}
        </div>
      </li>`
    )}
  </ol>`;
}
