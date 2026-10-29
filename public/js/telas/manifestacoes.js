import { api } from '../api.js';
import { html, raw, $, $$ } from '../ui.js';
import { cartaoManifestacao, ligarAvaliacoes } from './comum.js';

const FILTROS = [['', 'Todas'], ['RECEBIDA', 'Recebidas'], ['EM_ANALISE', 'Em análise'], ['ACEITA', 'Aceitas'], ['RECUSADA', 'Recusadas']];

export async function lista(main) {
  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo">
        <div><h1 class="titulo">Manifestações</h1></div>
      </header>
      <div class="filtros"><div class="abas" role="tablist">
        ${FILTROS.map(([v, r], i) => html`<button role="tab" class="aba ${raw(i === 0 ? 'ativa' : '')}"
            aria-selected="${i === 0}" data-status="${v}">${r}</button>`)}
      </div></div>
      <div class="manifestacoes" id="lista"></div>
    </section>`);

  const caixa = $('#lista', main);
  let filtro = '';
  const carregar = async () => {
    const linhas = await api.get('/admin/manifestacoes' + (filtro ? `?status=${filtro}` : ''));
    caixa.innerHTML = linhas.length
      ? String(html`${linhas.map(cartaoManifestacao)}`)
      : String(html`<p class="vazio">Nenhuma manifestação aqui.</p>`);
    ligarAvaliacoes(caixa, carregar);
  };
  $$('.aba', main).forEach((b) =>
    b.addEventListener('click', () => {
      filtro = b.dataset.status;
      $$('.aba', main).forEach((x) => {
        x.classList.toggle('ativa', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      carregar();
    })
  );
  await carregar();
}
