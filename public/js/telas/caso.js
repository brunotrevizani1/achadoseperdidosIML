// Ficha do caso: uma correspondência corpo × desaparecido, da sugestão até a liberação
import { api } from '../api.js';
import {
  html, raw, $, chip, data, dataHora, pts, avatar, toast, erroBanco, carimbo, modalForm,
  opcoes, linhaDoTempo, rotulo, compatibilometro, fraseScore, faixaIdade, parentesco,
  SEXO, TIPOS_ANALISE, METODOS,
} from '../ui.js';
import { boneco } from '../boneco.js';
import { listaSinais } from '../sinais.js';

const ICONE_RESULTADO = { COMPATIVEL: '✓', INCOMPATIVEL: '✗', INCONCLUSIVO: '?', PENDENTE: '…' };

export async function render(main, [id], ctx) {
  const c = await api.get(`/correspondencias/${id}`);
  const { corpo, desaparecido: d } = c;

  const idsCoincidentes = (lado) => new Set(c.coincidencias.map((x) => x[lado]));
  const coincCorpo = idsCoincidentes('id_sinal_corpo');
  const coincDesap = idsCoincidentes('id_sinal_desaparecido');
  const marcas = (sinais, coinc) =>
    sinais.map((s) => ({ regiao: s.regiao, lado: s.lado, classe: coinc.has(s.id_sinal) ? 'coincide' : 'marcado' }));

  const linhas = [
    ['Sexo', SEXO[corpo.sexo], c.pts_sexo, 20, SEXO[d.sexo]],
    ['Idade', faixaIdade(corpo.idade_estimada_min, corpo.idade_estimada_max), c.pts_idade, 20,
     d.idade_na_data != null ? `${d.idade_na_data} anos na data` : '?'],
    ['Altura', corpo.altura_estimada_cm ? `~${corpo.altura_estimada_cm} cm` : '?', c.pts_altura, 15,
     d.altura_cm ? `${d.altura_cm} cm` : '?'],
    ['Local', `${corpo.cidade}/${corpo.uf}`, c.pts_local, 15, d.cidade ? `${d.cidade}/${d.uf}` : '?'],
    ['Data', `encontrado ${data(corpo.data_encontrado)}`, c.pts_data, 10, `sumiu ${data(d.data_desaparecimento)}`],
    ['Sinais', `${corpo.sinais.length} no corpo`, c.pts_sinais, 20, `${coincDesap.size} de ${d.sinais.length} bateram`],
  ];

  const temCompativel = c.analises.some((a) => a.resultado === 'COMPATIVEL');
  const aberta = ['SUGERIDA', 'EM_ANALISE'].includes(c.status);
  const podeIdentificar = !c.identificacao && ['EM_ANALISE', 'CONFIRMADA'].includes(c.status) && ctx.pode('PERITO');
  const podeLiberar = c.identificacao && !c.liberacao && corpo.status === 'IDENTIFICADO' && ctx.pode('ATENDENTE', 'PERITO');

  const acoes = [
    c.status === 'SUGERIDA' && ctx.pode('INVESTIGADOR') && html`<button class="btn btn--primario" data-acao="assumir">🔍 Assumir a análise</button>`,
    ['EM_ANALISE', 'CONFIRMADA'].includes(c.status) && !c.identificacao && ctx.pode('INVESTIGADOR', 'PERITO')
      && html`<button class="btn" data-acao="analise">+ Registrar confronto</button>`,
    c.status === 'EM_ANALISE' && ctx.pode('INVESTIGADOR') && html`<button class="btn btn--verde" data-acao="confirmar">✓ Confirmar correspondência</button>`,
    podeIdentificar && html`<button class="btn btn--verde" data-acao="identificar">🪪 Identificar oficialmente</button>`,
    podeLiberar && html`<button class="btn btn--primario" data-acao="liberar">🕊 Liberar para a família</button>`,
    aberta && ctx.pode('INVESTIGADOR') && html`<button class="btn btn--perigo" data-acao="descartar">✕ Descartar</button>`,
  ].filter(Boolean);

  const proximoPasso = c.liberacao
    ? 'Caso encerrado. Família com resposta.'
    : c.identificacao
      ? 'Identidade confirmada. Falta a entrega do corpo à família (atendente ou perito).'
      : c.status === 'SUGERIDA'
        ? 'Sugerido pelo cruzamento. Um investigador precisa assumir.'
        : c.status === 'EM_ANALISE'
          ? 'Em apuração: registre os confrontos. Com resultado compatível, a perícia identifica oficialmente.'
          : c.status === 'CONFIRMADA'
            ? 'Correspondência confirmada pelo investigador. Aguardando identificação oficial pela perícia.'
            : 'Par descartado.';

  main.innerHTML = String(html`
    <section class="pagina">
      <a class="voltar" href="#/match">← Match do IML</a>
      <header class="caso-topo ficha">
        <a class="caso-topo__lado" href="#/corpos/${corpo.id_corpo}">${avatar('', 'corpo')}
          <span><b>${corpo.codigo_iml}</b><small>${chip(corpo.status)}</small></span></a>
        <div class="caso-topo__meio">
          ${compatibilometro(c.score_total, 170)}
          <p class="match__frase">${fraseScore(c.score_total)}</p>
          <p>${chip(c.status)} <small>origem ${rotulo(c.origem)} · gerada ${dataHora(c.data_geracao)}</small></p>
        </div>
        <a class="caso-topo__lado caso-topo__lado--dir" href="#/desaparecidos/${d.id_desaparecido}">
          <span><b>${d.nome_desaparecido}</b><small>${d.protocolo} · ${chip(d.status)}</small></span>${avatar(d.nome_desaparecido)}</a>
      </header>

      ${c.liberacao
        ? html`<div class="faixa faixa--encerrado">CASO ENCERRADO · entregue a ${c.liberacao.familiar} em ${dataHora(c.liberacao.data_liberacao)}</div>`
        : ''}

      <section class="ficha proximo">
        <div><h2 class="subtitulo">Próximo passo</h2><p>${proximoPasso}</p>
          ${c.justificativa ? html`<p class="justificativa">Justificativa: “${c.justificativa}”</p>` : ''}</div>
        <div class="proximo__acoes">${acoes.length ? acoes : html`<small class="dica">Nenhuma ação disponível para o perfil ${ctx.usuario.perfil}.</small>`}</div>
      </section>

      <div class="duas-colunas">
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Comparação critério a critério</h2>
            <table class="comparacao">
              <thead><tr><th scope="col">Critério</th><th scope="col">Corpo</th><th scope="col">Pontos</th><th scope="col">Desaparecido</th></tr></thead>
              <tbody>
                ${linhas.map(([nome, vc, p, max, vd]) => html`<tr class="${raw(p >= max ? 'bate' : p > 0 ? 'quase' : 'nao')}">
                  <th scope="row">${nome}</th><td>${vc}</td>
                  <td class="comparacao__pts">${pts(p)}<small>/${max}</small></td><td>${vd}</td></tr>`)}
              </tbody>
              <tfoot><tr><th scope="row">Total</th><td></td><td class="comparacao__pts"><b>${pts(c.score_total)}</b><small>/100</small></td><td></td></tr></tfoot>
            </table>
          </section>

          <section class="ficha">
            <h2 class="subtitulo">Confrontos e análises</h2>
            ${c.analises.length
              ? html`<ul class="analises">${c.analises.map(
                  (a) => html`<li class="analise analise--${a.resultado.toLowerCase()}">
                    <span class="analise__icone" aria-hidden="true">${ICONE_RESULTADO[a.resultado]}</span>
                    <div><b>${rotulo(a.tipo_analise)}</b> · ${chip(a.resultado)}
                      <small>${dataHora(a.data_analise)} · ${a.usuario}${a.numero_laudo ? ` · laudo ${a.numero_laudo}` : ''}</small>
                      ${a.descricao ? html`<p>${a.descricao}</p>` : ''}</div></li>`
                )}</ul>`
              : html`<p class="vazio">Nenhum confronto registrado ainda.</p>`}
          </section>

          ${c.identificacao
            ? html`<section class="ficha ficha--oficial">
                <h2 class="subtitulo">Identificação oficial</h2>
                <dl class="dados">
                  <dt>Método</dt><dd>${rotulo(c.identificacao.metodo)}</dd>
                  <dt>Perito</dt><dd>${c.identificacao.perito}</dd>
                  <dt>Data</dt><dd>${data(c.identificacao.data_identificacao)}</dd>
                  <dt>Laudo</dt><dd>${c.identificacao.numero_laudo || '—'}</dd>
                  <dt>Observações</dt><dd>${c.identificacao.observacoes || '—'}</dd>
                </dl></section>`
            : ''}
          ${c.liberacao
            ? html`<section class="ficha ficha--oficial">
                <h2 class="subtitulo">Liberação do corpo</h2>
                <dl class="dados">
                  <dt>Retirado por</dt><dd>${c.liberacao.familiar}</dd>
                  <dt>Destino</dt><dd>${rotulo(c.liberacao.destino)}</dd>
                  <dt>Funerária</dt><dd>${c.liberacao.funeraria || '—'}</dd>
                  <dt>Certidão de óbito</dt><dd>${c.liberacao.numero_certidao_obito || '—'}</dd>
                </dl></section>`
            : ''}
        </div>

        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Sinais lado a lado <small>(verde = bateu)</small></h2>
            <div class="bonecos-lado-a-lado">
              <div><h3 class="mini-titulo">Corpo</h3>${boneco({ marcas: marcas(corpo.sinais, coincCorpo), titulo: 'Sinais do corpo' })}</div>
              <div><h3 class="mini-titulo">Desaparecido</h3>${boneco({ marcas: marcas(d.sinais, coincDesap), titulo: 'Sinais do desaparecido' })}</div>
            </div>
            <h3 class="mini-titulo">No corpo</h3>${listaSinais(corpo.sinais, { destaque: coincCorpo })}
            <h3 class="mini-titulo">Informados pela família</h3>${listaSinais(d.sinais, { destaque: coincDesap })}
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Linha do tempo do caso</h2>
            ${linhaDoTempo(c.historico)}
          </section>
        </div>
      </div>
    </section>`);

  // -------------------------------------------------------------------
  // Ações
  // -------------------------------------------------------------------
  const executar = async (fn, sucesso) => {
    try {
      await fn();
      sucesso?.();
      setTimeout(ctx.recarregar, 1300);
    } catch (e) {
      erroBanco(e);
    }
  };

  const ACOES = {
    assumir: () =>
      executar(() => api.patch(`/correspondencias/${id}`, { acao: 'assumir' }), () => carimbo('EM APURAÇÃO', 'azul')),

    descartar: async () => {
      const r = await modalForm({
        titulo: 'Descartar correspondência',
        confirmar: 'Descartar',
        corpo: html`<label>Justificativa* <textarea name="justificativa" rows="3" required
          placeholder="Ex.: confronto de DNA negativo"></textarea></label>`,
      });
      if (r) executar(() => api.patch(`/correspondencias/${id}`, { acao: 'descartar', ...r }), () => carimbo('DESCARTADO'));
    },

    confirmar: async () => {
      const r = await modalForm({
        titulo: 'Confirmar correspondência',
        confirmar: 'Confirmar',
        corpo: html`${!temCompativel ? html`<p class="alerta">Atenção: nenhum confronto COMPATÍVEL registrado até agora.</p>` : ''}
          <label>Justificativa* <textarea name="justificativa" rows="3" required
          placeholder="Ex.: reconhecimento familiar e tatuagem conferem"></textarea></label>`,
      });
      if (r) executar(() => api.patch(`/correspondencias/${id}`, { acao: 'confirmar', ...r }), () => carimbo('CONFIRMADO', 'verde'));
    },

    analise: async () => {
      const r = await modalForm({
        titulo: 'Registrar confronto',
        confirmar: 'Registrar',
        corpo: html`<div class="campos">
          <label>Tipo* <select name="tipo_analise" required>${opcoes(TIPOS_ANALISE)}</select></label>
          <label>Resultado* <select name="resultado" required>${opcoes(['COMPATIVEL', 'INCOMPATIVEL', 'INCONCLUSIVO', 'PENDENTE'])}</select></label>
          <label class="largo">Laudo que embasa
            <select name="id_exame"><option value="">— nenhum —</option>
              ${c.exames.map((x) => html`<option value="${x.id_exame}">${rotulo(x.tipo_exame)} · ${x.numero_laudo || 'sem nº'} (${rotulo(x.status)})</option>`)}
            </select></label>
          <label class="largo">Descrição <textarea name="descricao" rows="3"></textarea></label>
        </div>`,
      });
      if (r) executar(() => api.post(`/correspondencias/${id}/analises`, r), () => toast('Confronto registrado.', 'sucesso'));
    },

    identificar: async () => {
      const r = await modalForm({
        titulo: `Identificar ${corpo.codigo_iml} como ${d.nome_desaparecido}`,
        confirmar: 'Assinar identificação',
        corpo: html`${!temCompativel ? html`<p class="alerta">Nenhum confronto COMPATÍVEL registrado. A nota do cruzamento não identifica ninguém sozinha.</p>` : ''}
          <div class="campos">
          <label>Método* <select name="metodo" required>${opcoes(METODOS)}</select></label>
          <label>Laudo/exame
            <select name="id_exame"><option value="">— nenhum —</option>
              ${c.exames.map((x) => html`<option value="${x.id_exame}">${rotulo(x.tipo_exame)} · ${x.numero_laudo || 'sem nº'}</option>`)}
            </select></label>
          <label>Nº do laudo <input name="numero_laudo" maxlength="30"></label>
          <label class="largo">Observações <textarea name="observacoes" rows="2"></textarea></label>
          </div>
          <p class="dica">Ao assinar, o banco marca o corpo como IDENTIFICADO, o registro como IDENTIFICADO_OBITO
            e descarta as outras sugestões dos dois.</p>`,
      });
      if (r) {
        executar(() => api.post('/identificacoes', { id_correspondencia: Number(id), ...r }), () => {
          carimbo('IDENTIFICADO', 'verde');
          toast(`${corpo.codigo_iml} agora tem nome: ${d.nome_desaparecido}.`, 'sucesso', 6000);
        });
      }
    },

    liberar: async () => {
      const r = await modalForm({
        titulo: 'Liberar o corpo para a família',
        confirmar: 'Liberar',
        corpo: html`<div class="campos">
          <label class="largo">Quem retira*
            <select name="id_familiar" required>
              ${d.familiares.map((f) => html`<option value="${f.id_familiar}">${f.nome} (${parentesco(f.parentesco)})</option>`)}
            </select></label>
          <label>Destino <select name="destino">${opcoes(['SEPULTAMENTO', 'CREMACAO', 'TRASLADO'])}</select></label>
          <label>Funerária <input name="funeraria" maxlength="120"></label>
          <label>Certidão de óbito <input name="numero_certidao_obito" maxlength="40"></label>
          <label class="largo">Observações <textarea name="observacoes" rows="2"></textarea></label>
        </div>`,
      });
      if (r) {
        executar(() => api.post('/liberacoes', { id_corpo: corpo.id_corpo, ...r }), () => {
          carimbo('CASO ENCERRADO');
          toast('Gaveta liberada. A família recebeu uma resposta.', 'sucesso', 6000);
        });
      }
    },
  };

  main.querySelectorAll('[data-acao]').forEach((b) => b.addEventListener('click', () => ACOES[b.dataset.acao]()));
}
