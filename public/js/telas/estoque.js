import { api } from '../api.js';
import { html, raw, $, $$, chip, data, rotulo, SEXO } from '../ui.js';

const SITUACOES = [['', 'Todos'], ['aberto', 'Em aberto'], ['encerrado', 'Devolvidos / identificados']];
let fecharAnterior = () => {};
const TIPOS = [['', 'Tudo'], ['objeto', 'Objetos'], ['corpo', 'Corpos']];

const cartaoObjeto = (o) => html`<a class="cartao" href="#/admin/objetos/${o.id_objeto}">
  <span class="cartao__corpo">
    <span class="cartao__tipo">Objeto · ${rotulo(o.tipo)}</span>
    <b class="cartao__titulo">${o.titulo}</b>
    <span class="cartao__meta">${o.codigo}</span>
    <span class="cartao__rodape">${chip(o.status)}
      ${o.pendentes ? html`<span class="aba__n" title="Manifestações pendentes">${o.pendentes}</span>` : ''}
      <span class="cartao__meta">${data(o.data_encontrado)}</span></span>
  </span></a>`;

const cartaoCorpo = (c) => html`<a class="cartao" href="#/admin/corpos/${c.id_corpo}">
  <span class="cartao__corpo">
    <span class="cartao__tipo">Corpo${c.gaveta_camara ? ` · Gaveta ${c.gaveta_camara}` : ''}</span>
    <b class="cartao__titulo">${SEXO[c.sexo]}${c.idade_estimada_min != null ? `, ${c.idade_estimada_min}–${c.idade_estimada_max ?? '?'} anos` : ''}</b>
    <span class="cartao__meta">${c.codigo_iml} · ${c.cidade}/${c.uf}</span>
    <span class="cartao__rodape">${chip(c.status)}
      ${c.pendentes ? html`<span class="aba__n" title="Manifestações pendentes">${c.pendentes}</span>` : ''}
      <span class="cartao__meta">${data(c.data_encontrado)}</span></span>
  </span></a>`;

export async function lista(main) {
  const [objetos, corpos] = await Promise.all([api.get('/admin/objetos'), api.get('/admin/corpos')]);
  const itens = [
    ...objetos.map((o) => ({ tipo: 'objeto', encerrado: o.status === 'DEVOLVIDO', data: o.data_encontrado, card: cartaoObjeto(o) })),
    ...corpos.map((c) => ({ tipo: 'corpo', encerrado: c.status === 'IDENTIFICADO', data: c.data_encontrado, card: cartaoCorpo(c) })),
  ].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  let tipo = location.hash.endsWith('/objetos') ? 'objeto' : location.hash.endsWith('/corpos') ? 'corpo' : '';
  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo">
        <h1 class="titulo">Estoque</h1>
      </header>
      <div class="filtros">
        <div class="abas" role="tablist">
          ${TIPOS.map(([v, r]) => html`<button role="tab" class="aba ${raw(v === tipo ? 'ativa' : '')}"
              aria-selected="${v === tipo}" data-tipo="${v}">${r}</button>`)}
        </div>
        <div class="filtro-menu">
          <button type="button" class="btn btn--icone" id="filtro" aria-haspopup="true" aria-expanded="false"
            aria-label="Filtrar por situação" title="Filtrar por situação">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>
            <span class="filtro-menu__ponto" hidden></span>
          </button>
          <div class="filtro-menu__lista" role="menu" hidden>
            ${SITUACOES.map(([v, r]) => html`<button type="button" role="menuitemradio" data-situacao="${v}"
                aria-checked="${v === ''}">${r}</button>`)}
          </div>
        </div>
        <div class="pagina__acoes filtros__novo">
          <a class="btn btn--primario" href="#/admin/objetos/novo">+ Objeto</a>
          <a class="btn btn--primario" href="#/admin/corpos/novo">+ Corpo</a>
        </div>
      </div>
      <div class="cartoes" id="lista"></div>
    </section>`);

  const caixa = $('#lista', main);
  let situacao = '';
  const botao = $('#filtro', main);
  const menu = $('.filtro-menu__lista', main);
  const abrir = (aberto) => {
    menu.hidden = !aberto;
    botao.setAttribute('aria-expanded', String(aberto));
  };
  const mostrar = () => {
    const f = itens.filter((i) =>
      (!tipo || i.tipo === tipo) &&
      (!situacao || (situacao === 'encerrado') === i.encerrado));
    caixa.innerHTML = f.length
      ? String(html`${f.map((i) => i.card)}`)
      : String(html`<p class="vazio">Nada por aqui.</p>`);
  };
  $$('.aba', main).forEach((b) =>
    b.addEventListener('click', () => {
      tipo = b.dataset.tipo;
      $$('.aba', main).forEach((x) => {
        x.classList.toggle('ativa', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      mostrar();
    })
  );
  botao.addEventListener('click', (ev) => {
    ev.stopPropagation();
    abrir(menu.hidden);
  });
  $$('[data-situacao]', menu).forEach((b) =>
    b.addEventListener('click', () => {
      situacao = b.dataset.situacao;
      $$('[data-situacao]', menu).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      $('.filtro-menu__ponto', main).hidden = !situacao;
      abrir(false);
      mostrar();
    })
  );
  // main é reaproveitado entre telas: troca o ouvinte global a cada visita
  document.removeEventListener('click', fecharAnterior);
  fecharAnterior = (ev) => {
    if (!menu.contains(ev.target)) abrir(false);
  };
  document.addEventListener('click', fecharAnterior);
  mostrar();
}
