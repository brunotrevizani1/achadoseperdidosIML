import { api, carregarDominios } from '../api.js';
import {
  html, raw, $, $$, chip, data, dataHora, pts, toast, erroBanco, carimbo, modalForm, opcoes,
  linhaDoTempo, rotulo, faixaIdade, SEXO, ICONE_SEXO, TIPOS_EXAME, corScore, hoje,
} from '../ui.js';
import { boneco } from '../boneco.js';
import { editorSinais, listaSinais, marcasDe } from '../sinais.js';
import { seletorLocal } from './comum.js';

const FILTROS = [
  ['', 'Todos'],
  ['AGUARDANDO_IDENTIFICACAO', 'Aguardando'],
  ['EM_ANALISE', 'Em análise'],
  ['IDENTIFICADO', 'Identificados'],
  ['LIBERADO', 'Liberados'],
];
const CONSERVACAO = ['PRESERVADO', 'DECOMPOSICAO_INICIAL', 'DECOMPOSICAO_AVANCADA', 'ESQUELETIZADO', 'CARBONIZADO'];
const GAVETAS = ['A', 'B', 'C'].flatMap((f) => Array.from({ length: 8 }, (_, i) => `${f}-${String(i + 1).padStart(2, '0')}`));

// ---------------------------------------------------------------------
// Lista (etiquetas de identificação)
// ---------------------------------------------------------------------
export async function lista(main, params, ctx) {
  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo">
        <div><h1 class="titulo">Corpos sob custódia</h1>
          <p class="pagina__sub">Cada etiqueta é alguém esperando ser chamado pelo nome.</p></div>
        ${ctx.pode('PERITO') ? html`<a class="btn btn--primario" href="#/corpos/novo">+ Check-in de corpo</a>` : ''}
      </header>
      <div class="filtros"><div class="abas" role="tablist">
        ${FILTROS.map(([v, r], i) => html`<button role="tab" class="aba ${raw(i === 0 ? 'ativa' : '')}"
            aria-selected="${i === 0}" data-status="${v}">${r}</button>`)}
      </div></div>
      <div class="etiquetas" id="etiquetas"></div>
    </section>`);

  const caixa = $('#etiquetas', main);
  const carregar = async (status) => {
    const linhas = await api.get('/corpos' + (status ? `?status=${status}` : ''));
    caixa.innerHTML = linhas.length
      ? String(html`${linhas.map(
          (c) => html`<a class="etiqueta" href="#/corpos/${c.id_corpo}">
            <span class="etiqueta__furo" aria-hidden="true"></span>
            <span class="etiqueta__codigo">${c.codigo_iml}</span>
            <span class="etiqueta__linha"><b>${ICONE_SEXO[c.sexo]} ${SEXO[c.sexo]}</b> · ${faixaIdade(c.idade_estimada_min, c.idade_estimada_max)}
              · ${c.altura_estimada_cm ? `~${c.altura_estimada_cm} cm` : 'altura ?'}</span>
            <span class="etiqueta__linha">Encontrado: ${c.local_nome || '?'} · ${c.cidade || ''}/${c.uf || ''} · ${data(c.data_encontrado)}</span>
            <span class="etiqueta__linha">${rotulo(c.estado_conservacao)} · ${c.sinais} sinal(is)</span>
            <span class="etiqueta__rodape">${chip(c.status)}
              ${c.gaveta_camara ? html`<span class="etiqueta__gaveta">Gaveta ${c.gaveta_camara}</span>` : ''}
              ${c.melhor_score ? html`<span class="mini-score score--${corScore(c.melhor_score)}">${pts(c.melhor_score)}</span>` : ''}</span>
          </a>`
        )}`)
      : String(html`<p class="vazio">Nenhum corpo com esse status.</p>`);
  };
  $$('.aba', main).forEach((b) =>
    b.addEventListener('click', () => {
      $$('.aba', main).forEach((x) => {
        x.classList.toggle('ativa', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      carregar(b.dataset.status);
    })
  );
  await carregar('');
}

// ---------------------------------------------------------------------
// Check-in (cadastro de corpo + registro de entrada + sinais)
// ---------------------------------------------------------------------
export async function novo(main, params, ctx) {
  if (!ctx.pode('PERITO')) {
    main.innerHTML = String(html`<section class="pagina vazio-grande"><h1 class="titulo">Recepção restrita</h1>
      <p>Só a perícia faz o check-in na câmara fria.</p></section>`);
    return;
  }
  const [dominios, ocupadas] = await Promise.all([carregarDominios(), api.get('/gavetas')]);
  const livres = GAVETAS.filter((g) => !ocupadas.includes(g));

  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo"><div>
        <h1 class="titulo">Check-in na câmara fria</h1>
        <p class="pagina__sub">Diária inclusa. Café da manhã, não.</p></div>
      </header>
      <form id="form-corpo" class="ficha form">
        <fieldset>
          <legend>Características estimadas pela perícia</legend>
          <div class="campos">
            <label>Sexo*
              <select name="sexo" required>
                <option value="">—</option><option value="M">Masculino</option>
                <option value="F">Feminino</option><option value="I">Indeterminado</option></select></label>
            <label>Idade mínima <input name="idade_estimada_min" type="number" min="0" max="120"></label>
            <label>Idade máxima <input name="idade_estimada_max" type="number" min="0" max="120"></label>
            <label>Altura estimada (cm) <input name="altura_estimada_cm" type="number" min="30" max="250"></label>
            <label>Peso estimado (kg) <input name="peso_estimado_kg" type="number" step="0.1" min="0"></label>
            <label>Conservação <select name="estado_conservacao"><option value="">—</option>${opcoes(CONSERVACAO)}</select></label>
            <label>Cor da pele <input name="cor_pele" maxlength="20"></label>
            <label>Cor do cabelo <input name="cor_cabelo" maxlength="20"></label>
            <label>Cor dos olhos <input name="cor_olhos" maxlength="20"></label>
            <label class="largo">Vestimenta <input name="vestimenta"></label>
            <label class="largo">Pertences encontrados junto <input name="pertences"></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Entrada: onde e como foi encontrado</legend>
          <div class="campos">
            <label>Data em que foi encontrado* <input name="data_encontrado" type="date" required max="${hoje()}" value="${hoje()}"></label>
            <label>Óbito estimado em <input name="data_obito_estimada" type="date" max="${hoje()}"></label>
            <label>Causa presumida
              <select name="id_causa_presumida"><option value="">—</option>
                ${dominios.causas.map((c) => html`<option value="${c.id_causa}">${c.descricao}${c.codigo_cid ? ` (${c.codigo_cid})` : ''}</option>`)}
              </select></label>
            <label>Órgão da remoção <input name="orgao_remocao" maxlength="60" placeholder="SAMU, Bombeiros…"></label>
            <label>Responsável pela remoção <input name="responsavel_remocao" maxlength="120"></label>
            <label>Boletim de ocorrência <input name="numero_boletim" maxlength="30"></label>
            <div class="largo" id="local-corpo"></div>
            <label class="largo">Circunstâncias <textarea name="circunstancias" rows="2"></textarea></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Sinais particulares</legend>
          <div id="editor-sinais"></div>
        </fieldset>
        <fieldset>
          <legend>Gaveta na câmara fria</legend>
          <div class="escolha-gaveta" role="radiogroup" aria-label="Gaveta">
            ${GAVETAS.map((g) => html`<label class="gaveta-radio ${raw(ocupadas.includes(g) ? 'ocupada' : '')}">
              <input type="radio" name="gaveta_camara" value="${g}" ${raw(ocupadas.includes(g) ? 'disabled' : '')}
                ${raw(g === livres[0] ? 'checked' : '')}><span>${g}</span></label>`)}
          </div>
          <p class="dica">${livres.length} gaveta(s) livre(s). As ocupadas estão riscadas: overbooking não é permitido.</p>
        </fieldset>
        <footer class="form__acoes"><span class="espaco"></span>
          <button type="submit" class="btn btn--primario">Fazer check-in</button></footer>
      </form>
    </section>`);

  const form = $('#form-corpo', main);
  const local = seletorLocal($('#local-corpo', main), dominios, 'Local onde foi encontrado', true);
  const sinais = editorSinais($('#editor-sinais', main), dominios);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    if (dados.idade_estimada_min && dados.idade_estimada_max &&
        Number(dados.idade_estimada_min) > Number(dados.idade_estimada_max)) {
      return toast('A idade mínima está maior que a máxima. A perícia é boa, mas não viaja no tempo.', 'erro');
    }
    dados.id_local = await local.valor();
    if (!dados.id_local) return dados.id_local === null && toast('Informe o local onde foi encontrado.', 'erro');
    dados.sinais = sinais();

    const botao = $('button[type=submit]', form);
    botao.disabled = true;
    try {
      const r = await api.post('/corpos', dados);
      carimbo('CHECK-IN OK', 'azul');
      toast(`${r.codigo_iml} registrado${r.gaveta_camara ? ` na gaveta ${r.gaveta_camara}` : ''}.`, 'sucesso', 6000);
      if (r.novas_correspondencias > 0) {
        setTimeout(() => toast(`Já temos ${r.novas_correspondencias} possível(is) match(es)! Corre pro Match do IML.`, 'info', 6500), 900);
      }
      setTimeout(() => (location.hash = `#/corpos/${r.id_corpo}`), 1300);
    } catch (e) {
      erroBanco(e);
      botao.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------
export async function ficha(main, [id], ctx) {
  const [c, dominios] = await Promise.all([api.get(`/corpos/${id}`), carregarDominios()]);

  main.innerHTML = String(html`
    <section class="pagina">
      <a class="voltar" href="#/corpos">← Corpos</a>
      <header class="pagina__topo">
        <div class="pagina__identidade"><span class="avatar avatar--corpo grande" aria-hidden="true">${ICONE_SEXO[c.sexo]}</span>
          <div><h1 class="titulo">${c.codigo_iml}</h1>
          <p class="pagina__sub">${c.gaveta_camara ? `Gaveta ${c.gaveta_camara} · ` : ''}${chip(c.status)}
            ${c.identificacao ? html` · identificado como <b>${c.identificacao.nome_desaparecido}</b>` : ''}</p></div>
        </div>
        ${ctx.pode('PERITO') && !['LIBERADO', 'SEPULTADO_NAO_IDENTIFICADO'].includes(c.status)
          ? html`<div class="pagina__acoes"><button class="btn" id="novo-exame">+ Registrar exame</button></div>`
          : ''}
      </header>

      ${c.liberacao
        ? html`<div class="faixa faixa--encerrado">CASO ENCERRADO · liberado para ${c.liberacao.familiar} em
            ${dataHora(c.liberacao.data_liberacao)}${c.liberacao.destino ? ` · ${rotulo(c.liberacao.destino)}` : ''}</div>`
        : ''}

      <div class="duas-colunas">
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Características estimadas</h2>
            <dl class="dados">
              <dt>Sexo</dt><dd>${SEXO[c.sexo]}</dd>
              <dt>Idade</dt><dd>${faixaIdade(c.idade_estimada_min, c.idade_estimada_max)}</dd>
              <dt>Altura / peso</dt><dd>${c.altura_estimada_cm ? `~${c.altura_estimada_cm} cm` : '—'} / ${c.peso_estimado_kg ? `~${c.peso_estimado_kg} kg` : '—'}</dd>
              <dt>Pele / cabelo / olhos</dt><dd>${[c.cor_pele, c.cor_cabelo, c.cor_olhos].map((x) => x || '—').join(' / ')}</dd>
              <dt>Conservação</dt><dd>${rotulo(c.estado_conservacao)}</dd>
              <dt>Vestimenta</dt><dd>${c.vestimenta || '—'}</dd>
              <dt>Pertences</dt><dd>${c.pertences || '—'}</dd>
            </dl>
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Entrada no IML</h2>
            <dl class="dados">
              <dt>Encontrado em</dt><dd>${data(c.data_encontrado)} · ${c.local_nome} · ${c.cidade}/${c.uf}</dd>
              <dt>Entrada</dt><dd>${dataHora(c.data_entrada)}</dd>
              <dt>Óbito estimado</dt><dd>${data(c.data_obito_estimada)}</dd>
              <dt>Causa presumida</dt><dd>${c.causa_presumida || '—'}</dd>
              <dt>Remoção</dt><dd>${[c.orgao_remocao, c.responsavel_remocao].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>BO</dt><dd>${c.numero_boletim || '—'}</dd>
              <dt>Circunstâncias</dt><dd>${c.circunstancias || '—'}</dd>
              <dt>Cadastrado por</dt><dd>${c.cadastrado_por || '—'}</dd>
            </dl>
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Exames periciais</h2>
            ${c.exames.length
              ? html`<ul class="exames">${c.exames.map(
                  (x) => html`<li><b>${rotulo(x.tipo_exame)}</b> ${chip(x.status)}
                    <small>${x.numero_laudo || 'sem laudo'} · solicitado ${data(x.data_solicitacao)}${x.data_realizacao ? ` · feito ${data(x.data_realizacao)}` : ''}${x.perito ? ` · ${x.perito}` : ''}</small>
                    ${x.conclusao ? html`<p>${x.conclusao}</p>` : ''}</li>`
                )}</ul>`
              : html`<p class="vazio">Nenhum exame registrado.</p>`}
          </section>
        </div>
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Sinais particulares</h2>
            <div class="sinais-com-boneco">${boneco({ marcas: marcasDe(c.sinais) })}${listaSinais(c.sinais)}</div>
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Matches com desaparecidos</h2>
            ${c.correspondencias.length
              ? html`<ul class="matches-mini">${c.correspondencias.map(
                  (m) => html`<li><a href="#/casos/${m.id_correspondencia}">
                    <span class="mini-score score--${corScore(m.score_total)}">${pts(m.score_total)}</span>
                    <span>${m.nome_desaparecido}</span>${chip(m.status)}</a></li>`
                )}</ul>`
              : html`<p class="vazio">Nenhum desaparecido compatível (nota ≥ 50) até agora.</p>`}
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Linha do tempo</h2>
            ${linhaDoTempo(c.historico)}
          </section>
        </div>
      </div>
    </section>`);

  $('#novo-exame', main)?.addEventListener('click', async () => {
    const dados = await modalForm({
      titulo: 'Registrar exame pericial',
      confirmar: 'Registrar',
      corpo: html`<div class="campos">
        <label>Tipo* <select name="tipo_exame" required>${opcoes(TIPOS_EXAME)}</select></label>
        <label>Status <select name="status">${opcoes(['CONCLUIDO', 'EM_ANDAMENTO', 'SOLICITADO'])}</select></label>
        <label>Nº do laudo <input name="numero_laudo" maxlength="30"></label>
        <label>Realizado em <input name="data_realizacao" type="date" max="${hoje()}"></label>
        <label class="largo">Causa definitiva (necropsia)
          <select name="id_causa"><option value="">—</option>
            ${dominios.causas.map((x) => html`<option value="${x.id_causa}">${x.descricao}</option>`)}</select></label>
        <label class="largo">Resultado <textarea name="resultado" rows="2"></textarea></label>
        <label class="largo">Conclusão do perito <textarea name="conclusao" rows="2"></textarea></label>
      </div>`,
    });
    if (!dados) return;
    try {
      await api.post(`/corpos/${id}/exames`, dados);
      carimbo('LAUDADO', 'azul');
      setTimeout(ctx.recarregar, 900);
    } catch (e) {
      erroBanco(e);
    }
  });
}
