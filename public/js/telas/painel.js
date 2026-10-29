import { api } from '../api.js';
import { html, raw, chip, rotulo } from '../ui.js';

export async function render(main, params, ctx) {
  const p = await api.get('/admin/painel');
  const n = (grupo, ...chaves) => chaves.reduce((t, k) => t + (p[grupo][k] || 0), 0);

  const stats = [
    ['Na fila', n('manifestacoes', 'RECEBIDA', 'EM_ANALISE'), '', '#/admin/manifestacoes'],
    ['Objetos', n('objetos', 'EM_GUARDA', 'DEVOLVIDO'), '', '#/admin/objetos'],
    ['Corpos', n('corpos', 'NAO_IDENTIFICADO', 'IDENTIFICADO'), '', '#/admin/corpos'],
    ['Manifestações', n('manifestacoes', 'RECEBIDA', 'EM_ANALISE', 'ACEITA', 'RECUSADA'), '', '#/admin/manifestacoes'],
  ];

  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo">
        <div>
          <h1 class="titulo">Bom plantão, ${ctx.usuario.nome.split(' ')[0]}!</h1>
        </div>
      </header>

      <div class="stats">
        ${stats.map(
          ([nome, valor, , link]) => html`<a class="stat" href="${link}">
            <span class="stat__valor">${valor}</span>
            <span class="stat__nome">${nome}</span></a>`
        )}
      </div>

      <div class="painel-grid">
        <section class="ficha">
          <h2 class="subtitulo">Para avaliar</h2>
          ${p.pendentes.length
            ? html`<ul class="radio">${p.pendentes.slice(0, 5).map(
                (m) => html`<li><span><b>${m.nome}</b> (${rotulo(m.parentesco)}) sobre <b>${m.item}</b> ${chip(m.status)}</span></li>`
              )}</ul>
              <p><a class="btn btn--primario" href="#/admin/manifestacoes">Abrir fila</a></p>`
            : html`<p class="vazio">Nada pendente.</p>`}
        </section>

        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Atividade recente</h2>
            <ul class="radio">
              ${p.eventos.slice(0, 6).map(
                (e) => html`<li><span><b>${e.rotulo}</b>
                    ${e.status_anterior ? raw('&rarr; ') : 'entrou como '}${chip(e.status_novo)}
                    ${e.usuario ? html`<small> por ${e.usuario}</small>` : ''}</span>
                </li>`
              )}
            </ul>
          </section>
        </div>
      </div>
    </section>`);
}
