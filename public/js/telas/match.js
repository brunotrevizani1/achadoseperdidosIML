import { api } from '../api.js';
import {
  html, raw, $, $$, chip, data, pts, avatar, toast, erroBanco, carimbo, modalForm, scanner,
  compatibilometro, barrasCriterios, fraseScore, faixaIdade, corScore, SEXO, ICONE_SEXO,
} from '../ui.js';

const ABAS = [
  ['SUGERIDA', 'Na fila'],
  ['EM_ANALISE', 'Em análise'],
  ['CONFIRMADA', 'Confirmadas'],
  ['DESCARTADA', 'Descartadas'],
];

export async function render(main, params, ctx) {
  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo">
        <div><h1 class="titulo">Match do IML</h1>
          <p class="pagina__sub">O aplicativo de relacionamentos que ninguém queria precisar usar.
            A nota é só prioridade: quem identifica é a perícia.</p></div>
        ${ctx.pode('INVESTIGADOR', 'PERITO')
          ? html`<button class="btn btn--primario btn--grande" id="rodar">⚡ Rodar cruzamento</button>` : ''}
      </header>
      <div class="filtros"><div class="abas" role="tablist">
        ${ABAS.map(([v, r], i) => html`<button role="tab" class="aba ${raw(i === 0 ? 'ativa' : '')}"
            aria-selected="${i === 0}" data-status="${v}">${r} <span class="aba__n" data-n="${v}"></span></button>`)}
      </div></div>
      <div id="area-match"></div>
    </section>`);

  const area = $('#area-match', main);
  let aba = 'SUGERIDA';
  let todas = [];

  const contarAbas = () =>
    ABAS.forEach(([v]) => ($(`[data-n="${v}"]`, main).textContent = todas.filter((c) => c.status === v).length));

  const carregar = async () => {
    todas = await api.get('/correspondencias');
    contarAbas();
    desenhar();
  };

  const desenhar = () => {
    const lista = todas.filter((c) => c.status === aba);
    if (!lista.length) {
      area.innerHTML = String(html`<div class="vazio-grande"><p class="vazio">${
        aba === 'SUGERIDA' ? 'Nenhum match na fila. Até o algoritmo está solteiro.' : 'Nada por aqui.'}</p></div>`);
      return;
    }
    if (aba === 'SUGERIDA') return deck(lista);
    area.innerHTML = String(html`<div class="grade-matches">${lista.map(cartaoCompacto)}</div>`);
  };

  // Modo "deslizar": um par por vez
  const deck = (lista) => {
    let i = 0;
    const mostrar = () => {
      if (i >= lista.length) i = 0;
      const c = lista[i];
      const investigador = ctx.pode('INVESTIGADOR');
      area.innerHTML = String(html`
        <div class="deck">
          <p class="deck__contador">Par ${i + 1} de ${lista.length}</p>
          ${cartaoMatch(c)}
          <div class="deck__acoes">
            ${investigador ? html`<button class="redondo redondo--nao" id="descartar" title="Descartar (←)" aria-label="Descartar">✕</button>` : ''}
            <button class="redondo redondo--pular" id="pular" title="Próximo (↓)" aria-label="Próximo par">↻</button>
            ${investigador
              ? html`<button class="redondo redondo--sim" id="assumir" title="Investigar (→)" aria-label="Assumir a análise">🔍</button>`
              : html`<a class="btn" href="#/casos/${c.id_correspondencia}">Ver o caso</a>`}
          </div>
          ${investigador ? html`<p class="dica">Atalhos: ← descartar · ↓ próximo · → investigar</p>` : ''}
        </div>`);
      $('#pular', area).addEventListener('click', () => animar('pulo', () => { i++; mostrar(); }));
      $('#descartar', area)?.addEventListener('click', () => descartar(c));
      $('#assumir', area)?.addEventListener('click', () => assumir(c));
    };
    const animar = (classe, depois) => {
      const card = $('.match', area);
      if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return depois();
      card.classList.add(`match--${classe}`);
      setTimeout(depois, 380);
    };
    const descartar = async (c) => {
      const r = await modalForm({
        titulo: 'Descartar este par',
        confirmar: 'Descartar',
        corpo: html`<p>${c.codigo_iml} × ${c.nome_desaparecido}</p>
          <label>Justificativa* <textarea name="justificativa" rows="3" required
            placeholder="O banco exige. Ex.: tatuagem é de outro desenho"></textarea></label>`,
      });
      if (!r) return;
      try {
        await api.patch(`/correspondencias/${c.id_correspondencia}`, { acao: 'descartar', justificativa: r.justificativa });
        animar('nao', async () => {
          toast('Par descartado. Fica a amizade.');
          await carregar();
        });
      } catch (e) {
        erroBanco(e);
      }
    };
    const assumir = async (c) => {
      try {
        await api.patch(`/correspondencias/${c.id_correspondencia}`, { acao: 'assumir' });
        animar('sim', () => {
          carimbo("IT'S A MATCH!", 'verde');
          setTimeout(() => (location.hash = `#/casos/${c.id_correspondencia}`), 1100);
        });
      } catch (e) {
        erroBanco(e);
      }
    };
    const teclas = (ev) => {
      if (!document.body.contains(area) || document.querySelector('dialog[open]')) return;
      if (aba !== 'SUGERIDA' || !$('.deck', area)) return;
      if (ev.key === 'ArrowDown') $('#pular', area)?.click();
      if (ev.key === 'ArrowLeft') $('#descartar', area)?.click();
      if (ev.key === 'ArrowRight') $('#assumir', area)?.click();
    };
    document.removeEventListener('keydown', window.__tecladoMatch);
    window.__tecladoMatch = teclas;
    document.addEventListener('keydown', teclas);
    mostrar();
  };

  $$('.aba', main).forEach((b) =>
    b.addEventListener('click', () => {
      aba = b.dataset.status;
      $$('.aba', main).forEach((x) => {
        x.classList.toggle('ativa', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      desenhar();
    })
  );

  $('#rodar', main)?.addEventListener('click', async (ev) => {
    const botao = ev.currentTarget;
    botao.disabled = true;
    const fechar = scanner();
    try {
      const { novas } = await api.post('/cruzamento/rodar');
      await fechar();
      toast(novas ? `${novas} novo(s) match(es) na fila!` : 'Nenhum par novo. Os existentes continuam na fila.',
            novas ? 'sucesso' : 'info');
      await carregar();
    } catch (e) {
      await fechar();
      erroBanco(e);
    }
    botao.disabled = false;
  });

  await carregar();
}

// ---------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------

export function cartaoMatch(c) {
  return html`<article class="match" aria-label="Par ${c.codigo_iml} e ${c.nome_desaparecido}">
    <div class="match__lados">
      <a class="match__lado" href="#/corpos/${c.id_corpo}">
        ${avatar('', 'corpo')}
        <b>${c.codigo_iml}</b>
        <small>${ICONE_SEXO[c.sexo_corpo]} ${SEXO[c.sexo_corpo]} · ${faixaIdade(c.idade_estimada_min, c.idade_estimada_max)}</small>
        <small>${c.altura_estimada_cm ? `~${c.altura_estimada_cm} cm` : 'altura ?'} · ${c.cidade_corpo}/${c.uf_corpo}</small>
        <small>encontrado ${data(c.data_encontrado)}</small>
      </a>
      <div class="match__meio">
        ${compatibilometro(c.score_total)}
        <p class="match__frase">${fraseScore(c.score_total)}</p>
      </div>
      <a class="match__lado" href="#/desaparecidos/${c.id_desaparecido}">
        ${avatar(c.nome_desaparecido)}
        <b>${c.nome_desaparecido}</b>
        <small>${SEXO[c.sexo_desap]} · ${c.idade_desap ?? '?'} anos na data</small>
        <small>${c.altura_desap ? `${c.altura_desap} cm` : 'altura ?'} · ${c.cidade_desap ? `${c.cidade_desap}/${c.uf_desap}` : 'local ?'}</small>
        <small>sumiu ${data(c.data_desaparecimento)}</small>
      </a>
    </div>
    ${barrasCriterios(c)}
    <p class="match__sinais">Sinais: ${c.sinais_coincidentes} coincidência(s) de ${c.sinais_desap} do desaparecido
      ${c.sinais_coincidentes ? raw(' 🎯') : ''}</p>
  </article>`;
}

function cartaoCompacto(c) {
  return html`<a class="match-compacto" href="#/casos/${c.id_correspondencia}">
    <span class="mini-score score--${corScore(c.score_total)}">${pts(c.score_total)}</span>
    <span class="match-compacto__nomes"><b>${c.codigo_iml}</b> × <b>${c.nome_desaparecido}</b>
      <small>${c.analista ? `analista: ${c.analista}` : 'sem analista'}</small>
      ${c.justificativa ? html`<small class="match-compacto__just">“${c.justificativa}”</small>` : ''}</span>
    ${chip(c.status)}
  </a>`;
}
