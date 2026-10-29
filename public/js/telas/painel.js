import { api } from '../api.js';
import { html, raw, chip, rotulo, dataHora, pts, contar, ICONE_SEXO, corScore } from '../ui.js';

const FILEIRAS = ['A', 'B', 'C'];
const POR_FILEIRA = 8;

const RECADOS = [
  'Lembrete do RH: a câmara fria não é lugar para guardar marmita.',
  'O café da copa acabou de novo. A perícia está investigando.',
  'Dica do dia: tatuagem com nome de ex também conta como sinal particular.',
  'Meta do mês: zero corpos sepultados sem identificação.',
  'O algoritmo dá a nota, mas quem bate o martelo é a perícia.',
  'Aviso: a gaveta B-08 range. Já abrimos chamado em 2019.',
];

const soma = (obj, ...chaves) => chaves.reduce((t, k) => t + (obj[k] || 0), 0);

export async function render(main, params, ctx) {
  const p = await api.get('/painel');
  const porGaveta = Object.fromEntries(p.gavetas.map((g) => [g.gaveta_camara, g]));
  const recado = RECADOS[Math.floor(Math.random() * RECADOS.length)];

  const stats = [
    ['Hóspedes na câmara fria', soma(p.corpos, 'AGUARDANDO_IDENTIFICACAO', 'EM_ANALISE'), 'sem check-out previsto', '#/corpos'],
    ['Pessoas sendo procuradas', soma(p.desaparecidos, 'ATIVO', 'EM_ANALISE'), 'alguém está esperando notícia', '#/desaparecidos'],
    ['Matches na fila', soma(p.correspondencias, 'SUGERIDA'), 'aguardando um investigador', '#/match'],
    ['Casos resolvidos', soma(p.desaparecidos, 'IDENTIFICADO_OBITO', 'LOCALIZADO_VIVO'), 'famílias com resposta', '#/desaparecidos'],
  ];

  const gaveta = (codigo) => {
    const g = porGaveta[codigo];
    if (!g) {
      return html`<div class="gaveta gaveta--livre" title="Gaveta ${codigo} livre">
        <span class="gaveta__puxador"></span><span class="gaveta__codigo">${codigo}</span>
        <span class="gaveta__info">livre ❄</span></div>`;
    }
    return html`<a class="gaveta gaveta--${g.status.toLowerCase()}" href="#/corpos/${g.id_corpo}"
        title="${g.codigo_iml} · ${rotulo(g.status)}">
      <span class="gaveta__puxador"></span>
      <span class="gaveta__codigo">${codigo}</span>
      <span class="gaveta__info"><b>${ICONE_SEXO[g.sexo]} ${g.codigo_iml.slice(-6)}</b>
        <small>${g.dias_na_camara} dia${g.dias_na_camara === 1 ? '' : 's'} hospedado</small></span>
      ${g.melhor_score ? html`<span class="gaveta__score score--${corScore(g.melhor_score)}">${pts(g.melhor_score)}</span>` : ''}
    </a>`;
  };

  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo">
        <div>
          <h1 class="titulo">Bom plantão, ${ctx.usuario.nome.split(' ')[0]}!</h1>
          <p class="pagina__sub">📌 ${recado}</p>
        </div>
        <div class="pagina__acoes">
          ${ctx.pode('ATENDENTE') ? html`<a class="btn" href="#/desaparecidos/novo">+ Registrar sumiço</a>` : ''}
          ${ctx.pode('PERITO') ? html`<a class="btn" href="#/corpos/novo">+ Check-in de corpo</a>` : ''}
          <a class="btn btn--primario" href="#/match">Abrir o Match do IML</a>
        </div>
      </header>

      <div class="stats">
        ${stats.map(
          ([nome, valor, sub, link]) => html`<a class="stat" href="${link}">
            <span class="stat__valor" data-contar="${valor}">0</span>
            <span class="stat__nome">${nome}</span><small>${sub}</small></a>`
        )}
      </div>

      <div class="painel-grid">
        <section class="ficha camara">
          <header class="ficha__topo">
            <h2 class="subtitulo">Câmara Fria · Hotel Zero Grau</h2>
            <span class="legenda">
              <i class="leg leg--aguardando_identificacao"></i>aguardando
              <i class="leg leg--em_analise"></i>em análise
              <i class="leg leg--identificado"></i>identificado
            </span>
          </header>
          <div class="gavetas">
            ${FILEIRAS.map((f) =>
              Array.from({ length: POR_FILEIRA }, (_, i) => gaveta(`${f}-${String(i + 1).padStart(2, '0')}`))
            )}
          </div>
          <p class="dica">Clique numa gaveta para abrir a ficha. Temperatura atual: 4 °C. Simpatia do atendimento: também.</p>
        </section>

        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Top matches</h2>
            ${p.top_matches.length
              ? html`<ol class="top">
                ${p.top_matches.map(
                  (m) => html`<li><a href="#/casos/${m.id_correspondencia}">
                    <span class="top__score score--${corScore(m.score_total)}">${pts(m.score_total)}</span>
                    <span><b>${m.codigo_iml}</b> × ${m.nome_desaparecido}${m.apelido ? ` (“${m.apelido}”)` : ''}
                    <br>${chip(m.status)}</span></a></li>`
                )}</ol>`
              : html`<p class="vazio">Nenhum match na fila. Até o algoritmo está solteiro.</p>`}
          </section>

          <section class="ficha">
            <h2 class="subtitulo">Rádio-corredor <small>(histórico de status)</small></h2>
            <ul class="radio">
              ${p.eventos.map(
                (e) => html`<li>
                  <span class="radio__quando">${dataHora(e.data_alteracao)}</span>
                  <span><b>${e.rotulo || `${e.entidade} #${e.id_registro}`}</b>
                    ${e.status_anterior ? raw('&rarr; ') : 'entrou como '}${chip(e.status_novo)}
                    ${e.usuario ? html`<small> por ${e.usuario}</small>` : ''}</span>
                </li>`
              )}
            </ul>
          </section>
        </div>
      </div>
    </section>`);

  contar(main);
}
