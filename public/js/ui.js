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
  AGUARDANDO_IDENTIFICACAO: 'Aguardando identificação',
  EM_ANALISE: 'Em análise',
  IDENTIFICADO: 'Identificado',
  LIBERADO: 'Liberado',
  SEPULTADO_NAO_IDENTIFICADO: 'Sepultado s/ identificação',
  ATIVO: 'Ativo',
  LOCALIZADO_VIVO: 'Localizado vivo',
  IDENTIFICADO_OBITO: 'Identificado (óbito)',
  ENCERRADO: 'Encerrado',
  SUGERIDA: 'Sugerida',
  DESCARTADA: 'Descartada',
  CONFIRMADA: 'Confirmada',
  PRESERVADO: 'Preservado',
  DECOMPOSICAO_INICIAL: 'Decomposição inicial',
  DECOMPOSICAO_AVANCADA: 'Decomposição avançada',
  ESQUELETIZADO: 'Esqueletizado',
  CARBONIZADO: 'Carbonizado',
  COMPATIVEL: 'Compatível',
  INCOMPATIVEL: 'Incompatível',
  INCONCLUSIVO: 'Inconclusivo',
  PENDENTE: 'Pendente',
  SOLICITADO: 'Solicitado',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};
export const rotulo = (v) => ROTULOS[v] || (v ? String(v).replaceAll('_', ' ').toLowerCase() : '—');

export const SEXO = { M: 'Masculino', F: 'Feminino', I: 'Indeterminado' };
export const ICONE_SEXO = { M: '♂', F: '♀', I: '⚲' };

export const PARENTESCOS = ['PAI', 'MAE', 'FILHO', 'FILHA', 'IRMAO', 'IRMA', 'CONJUGE', 'AVO', 'NETO',
  'TIO', 'SOBRINHO', 'PRIMO', 'OUTRO'];
export const NOME_PARENTESCO = { MAE: 'Mãe', IRMAO: 'Irmão', IRMA: 'Irmã', CONJUGE: 'Cônjuge', AVO: 'Avô/Avó' };
export const parentesco = (p) => NOME_PARENTESCO[p] || p.charAt(0) + p.slice(1).toLowerCase();

export const TIPOS_ANALISE = ['COMPARACAO_FOTOGRAFICA', 'CONFRONTO_DIGITAL', 'CONFRONTO_DNA',
  'CONFRONTO_ODONTOLOGICO', 'RECONHECIMENTO_FAMILIAR', 'ANALISE_DOCUMENTAL', 'ENTREVISTA_FAMILIAR'];
export const METODOS = ['DIGITAL', 'DNA', 'ARCADA_DENTARIA', 'RECONHECIMENTO_VISUAL', 'DOCUMENTAL', 'ANTROPOLOGICO'];
export const TIPOS_EXAME = ['NECROPSIA', 'PAPILOSCOPICO', 'ODONTOLEGAL', 'DNA', 'ANTROPOLOGICO',
  'TOXICOLOGICO', 'RADIOLOGICO'];
export const TIPOS_LOCAL = ['VIA_PUBLICA', 'RESIDENCIA', 'RIO_LAGO', 'MATA', 'HOSPITAL', 'RODOVIA',
  'ESTABELECIMENTO', 'OUTRO'];

export const chip = (status) => html`<span class="chip chip--${(status || '').toLowerCase()}">${rotulo(status)}</span>`;

export const opcoes = (lista, selecionado, rot = rotulo) =>
  lista.map((v) => html`<option value="${v}" ${raw(v === selecionado ? 'selected' : '')}>${rot(v)}</option>`);

// ---------------------------------------------------------------------
// Datas e números
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
export const hoje = () => new Date().toISOString().slice(0, 10);
export const pts = (n) => (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(1));

export function faixaIdade(min, max) {
  if (min == null && max == null) return 'idade ?';
  if (min === max) return `${min} anos`;
  return `${min ?? '?'}–${max ?? '?'} anos`;
}

// ---------------------------------------------------------------------
// Frases do score (o "compatibilômetro")
// ---------------------------------------------------------------------
export function fraseScore(s) {
  if (s >= 100) return 'Alma gêmea do banco de dados';
  if (s >= 85) return 'Isso está ficando sério';
  if (s >= 70) return 'Tem química!';
  if (s >= 60) return 'Rolou um clima';
  if (s >= 50) return 'Talvez… se apertar os olhos';
  return 'Nem o algoritmo acredita';
}
export const corScore = (s) => (s >= 85 ? 'alto' : s >= 65 ? 'medio' : 'baixo');

export function compatibilometro(score, tamanho = 150) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const angulo = -90 + (s / 100) * 180;
  return html`
    <div class="gauge gauge--${corScore(s)}" style="--tam:${tamanho}px" role="img"
         aria-label="Compatibilidade ${pts(s)} de 100">
      <svg viewBox="0 0 120 70" aria-hidden="true">
        <path d="M10 62 A50 50 0 0 1 110 62" class="gauge__trilho"/>
        <path d="M10 62 A50 50 0 0 1 110 62" class="gauge__valor" pathLength="100"
              style="stroke-dasharray:${s} 100"/>
        <g class="gauge__ponteiro" style="transform: rotate(${angulo}deg)">
          <line x1="60" y1="62" x2="60" y2="20"/>
          <circle cx="60" cy="62" r="5"/>
        </g>
      </svg>
      <div class="gauge__numero">${pts(s)}<small>/100</small></div>
    </div>`;
}

export function barrasCriterios(c) {
  const criterios = [
    ['Sexo', c.pts_sexo, 20],
    ['Idade', c.pts_idade, 20],
    ['Altura', c.pts_altura, 15],
    ['Local', c.pts_local, 15],
    ['Data', c.pts_data, 10],
    ['Sinais', c.pts_sinais, 20],
  ];
  return html`<ul class="barras">
    ${criterios.map(
      ([nome, v, max]) => html`
        <li>
          <span class="barras__nome">${nome}</span>
          <span class="barras__trilho"><span class="barras__valor ${raw(v >= max ? 'cheia' : v > 0 ? '' : 'zero')}"
                style="--pct:${(100 * v) / max}%"></span></span>
          <span class="barras__pts">${pts(v)}<small>/${max}</small></span>
        </li>`
    )}
  </ul>`;
}

// ---------------------------------------------------------------------
// Avatares desenhados (nenhuma foto real)
// ---------------------------------------------------------------------
export function avatar(nome, tipo = 'pessoa') {
  if (tipo === 'corpo') {
    return html`<span class="avatar avatar--corpo" aria-hidden="true">
      <svg viewBox="0 0 40 40"><circle cx="20" cy="14" r="7"/><path d="M6 38c1-9 7-14 14-14s13 5 14 14z"/>
      <text x="20" y="18" text-anchor="middle">?</text></svg></span>`;
  }
  const iniciais = String(nome || '?')
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  let h = 0;
  for (const ch of String(nome)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return html`<span class="avatar" style="--matiz:${h}" aria-hidden="true">${iniciais}</span>`;
}

// ---------------------------------------------------------------------
// Toasts, modais, carimbo, confete e scanner
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

export const erroBanco = (e) => toast(`O banco disse não (e ele não aceita suborno): ${e.message}`, 'erro', 6500);

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
    form.addEventListener('submit', (ev) => {
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

export function carimbo(texto, cor = 'vermelho') {
  const el = document.createElement('div');
  el.className = `carimbo carimbo--${cor}`;
  el.innerHTML = `<span>${esc(texto)}</span>`;
  document.body.append(el);
  setTimeout(() => el.remove(), 1900);
}

export function confete(qtd = 90) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cores = ['#f6d860', '#2e6b4a', '#23508e', '#b8322a', '#d9822b', '#7a4fa3'];
  const caixa = document.createElement('div');
  caixa.className = 'confete';
  for (let i = 0; i < qtd; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = cores[i % cores.length];
    p.style.animationDelay = Math.random() * 0.6 + 's';
    p.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    p.style.setProperty('--giro', Math.random() * 720 - 360 + 'deg');
    caixa.append(p);
  }
  document.body.append(caixa);
  setTimeout(() => caixa.remove(), 4000);
}

const FRASES_SCANNER = [
  'Comparando tatuagens com lupa de verdade…',
  'Medindo alturas com a régua do estagiário…',
  'Calculando idades sem perguntar a ninguém…',
  'Consultando o mapa do Rio Grande do Sul…',
  'Contando os dias no calendário da copa…',
  'Ignorando o horóscopo (não é critério pericial)…',
  'Pedindo mais um café para o perito…',
  'Rodando a view vw_candidatos_correspondencia…',
];

export function scanner(duracaoMin = 2600) {
  const el = document.createElement('div');
  el.className = 'scanner';
  el.innerHTML = `<div class="scanner__caixa"><div class="scanner__luz"></div>
    <p class="scanner__titulo">Cruzando os registros</p><p class="scanner__frase"></p></div>`;
  document.body.append(el);
  const frase = $('.scanner__frase', el);
  let i = 0;
  const trocar = () => (frase.textContent = FRASES_SCANNER[i++ % FRASES_SCANNER.length]);
  trocar();
  const timer = setInterval(trocar, 650);
  const inicio = Date.now();
  return async () => {
    const falta = duracaoMin - (Date.now() - inicio);
    if (falta > 0) await new Promise((r) => setTimeout(r, falta));
    clearInterval(timer);
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 300);
  };
}

// Anima números de 0 até o valor (contadores do painel)
export function contar(raiz = document) {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $$('[data-contar]', raiz).forEach((el) => {
    const alvo = Number(el.dataset.contar);
    if (reduzido || !alvo) return (el.textContent = alvo);
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
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
