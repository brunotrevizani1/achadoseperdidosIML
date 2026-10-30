import { api } from '../api.js';
import { html, raw, $, chip, rotulo } from '../ui.js';
import { montarCamara } from '../tres/camara3d.js';

export async function render(main, params, ctx) {
  const [p, todosCorpos] = await Promise.all([api.get('/admin/painel'), api.get('/admin/corpos')]);
  const gavetas = todosCorpos
    .filter((c) => c.status === 'NAO_IDENTIFICADO')
    .map((c) => ({ ...c, tipo: 'corpo', id: c.id_corpo, codigo: c.codigo_iml }));
  const capacidade = Math.max(3, Math.ceil(gavetas.length / 4)) * 4;
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

      <section class="ficha camara">
        <div class="camara__cena" id="camara3d" role="img" aria-label="Câmara fria em 3D com as gavetas ocupadas"></div>
        <div class="camara__info">
          <h2 class="subtitulo">Câmara fria</h2>
          <p class="camara__numero"><b>${gavetas.length}</b> de ${capacidade} gavetas ocupadas</p>
          <ul class="camara__legenda">
            <li><span class="camara__ponto camara__ponto--aberta"></span>${gavetas.length} ${gavetas.length === 1 ? 'não identificado' : 'não identificados'}</li>
            <li><span class="camara__ponto camara__ponto--livre"></span>${capacidade - gavetas.length} ${capacidade - gavetas.length === 1 ? 'gaveta livre' : 'gavetas livres'}</li>
            <li><span class="camara__ponto camara__ponto--ok"></span>${p.corpos.IDENTIFICADO || 0} ${(p.corpos.IDENTIFICADO || 0) === 1 ? 'já identificado' : 'já identificados'}</li>
          </ul>
          <p class="dica">Arraste a câmara para girar.</p>
          <p><a class="btn" href="#/admin/corpos">Ver corpos</a></p>
        </div>
      </section>

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

  try {
    montarCamara($('#camara3d', main), gavetas);
  } catch {
    $('#camara3d', main).hidden = true; // sem WebGL: o painel segue só com os números
  }
}
