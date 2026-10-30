import { api, carregarLocais } from '../api.js';
import {
  html, raw, $, $$, chip, data, toast, erroBanco, modalForm, linhaDoTempo, rotulo, SEXO, hoje, opcoes,
  COR_PELE, COR_CABELO, TAMANHO_CABELO, COR_OLHOS, LOCAIS_TATUAGEM, ESTILOS_TATUAGEM, rotuloTatuagens,
} from '../ui.js';
import { mostrarModelo } from '../tres/visor3d.js';
import { seletorLocal, cartaoManifestacao, ligarAvaliacoes } from './comum.js';


const situacao = (c) =>
  c.status === 'IDENTIFICADO'
    ? html`${chip(c.status)}`
    : html`${chip(c.status)} <span class="etiqueta__gaveta">no mural</span>`;

export async function novo(main) {
  const locais = await carregarLocais();
  main.innerHTML = String(html`
    <section class="pagina">
      <a class="voltar" href="#/admin/corpos">← Câmara fria</a>
      <header class="pagina__topo"><div><h1 class="titulo">Cadastrar corpo</h1></div></header>
      <form id="form-corpo" class="ficha form">
        <fieldset>
          <legend>Estimativas e aparência</legend>
          <div class="aparencia">
          <div class="campos">
            <label>Sexo*
              <select name="sexo" required><option value="">—</option><option value="M">Masculino</option>
                <option value="F">Feminino</option><option value="I">Indeterminado</option></select></label>
            <label>Idade mínima <input name="idade_estimada_min" type="number" min="0" max="120"></label>
            <label>Idade máxima <input name="idade_estimada_max" type="number" min="0" max="120"></label>
            <label>Altura (cm) <input name="altura_estimada_cm" type="number" min="30" max="250"></label>
            <label>Cor da pele <select name="cor_pele"><option value="">—</option>${opcoes(COR_PELE)}</select></label>
            <label>Cor dos olhos <select name="cor_olhos"><option value="">—</option>${opcoes(COR_OLHOS)}</select></label>
            <label>Cor do cabelo <select name="cabelo_cor"><option value="">—</option>${opcoes(COR_CABELO)}</select></label>
            <label>Tamanho do cabelo <select name="cabelo_tam"><option value="">—</option>${opcoes(TAMANHO_CABELO)}</select></label>
            <div class="largo tatuagem">
              <label class="check"><input type="checkbox" id="tem-tatuagem"> Tem tatuagem</label>
              <div class="tatuagem__locais" hidden>
                ${LOCAIS_TATUAGEM.map((k) => html`<div class="tatuagem__linha">
                  <label class="check"><input type="checkbox" name="tat" value="${k}"> ${rotulo(k)}</label>
                  <select name="tat_${k}" aria-label="Estilo da tatuagem: ${rotulo(k)}" disabled>${opcoes(ESTILOS_TATUAGEM)}</select>
                </div>`)}
              </div>
            </div>
          </div>
          <div class="previa" id="previa" role="img" aria-label="Pré-visualização do boneco"></div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Público (mural)</legend>
          <div class="campos">
            <label class="largo">Características gerais
              <textarea name="caracteristicas" rows="3"
                placeholder="Roupas, tatuagem, cicatriz…"></textarea></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Interno</legend>
          <div class="campos">
            <label>Encontrado em* <input name="data_encontrado" type="date" required max="${hoje()}" value="${hoje()}"></label>
            <label>Gaveta na câmara <input name="gaveta_camara" maxlength="10" placeholder="A-01"></label>
            <div class="largo" id="local"></div>
            <label class="largo">Observações internas <textarea name="observacoes" rows="2"
              placeholder="Uso interno, não vai ao mural"></textarea></label>
          </div>
        </fieldset>
        <footer class="form__acoes"><span class="espaco"></span>
          <button type="submit" class="btn btn--primario">Cadastrar corpo</button></footer>
      </form>
    </section>`);

  const form = $('#form-corpo', main);
  const local = seletorLocal($('#local', main), locais, 'Local onde foi encontrado');

  // cabelo = cor + tamanho ("Loiro, longo"); careca não tem tamanho
  const cabelo = (d) => (d.cabelo_cor === 'Careca' || !d.cabelo_tam ? d.cabelo_cor : `${d.cabelo_cor || ''}, ${d.cabelo_tam.toLowerCase()}`.replace(/^, /, ''));
  // um item por local marcado, com o estilo escolhido: "BRACO_D:FLORAL,PEITO:CHAMAS"
  const tatuagens = (fd) => fd.getAll('tat').map((k) => `${k}:${fd.get(`tat_${k}`) || 'TRIBAL'}`).join(',');
  const lerAparencia = () => {
    const fd = new FormData(form);
    const d = Object.fromEntries(fd);
    return { tipo: 'corpo', id: 0, sexo: d.sexo || 'I', cor_pele: d.cor_pele, cor_cabelo: cabelo(d), cor_olhos: d.cor_olhos, tatuagens: tatuagens(fd) };
  };

  const temTatuagem = $('#tem-tatuagem', main);
  const locaisTatuagem = $('.tatuagem__locais', main);
  const ligarEstilos = () => $$('[name=tat]', form).forEach((c) => {
    $(`[name=tat_${c.value}]`, form).disabled = !c.checked; // o estilo só vale para o local marcado
  });
  temTatuagem.addEventListener('change', () => {
    locaisTatuagem.hidden = !temTatuagem.checked;
    if (!temTatuagem.checked) $$('[name=tat]', form).forEach((c) => (c.checked = false));
    ligarEstilos();
  });
  $$('[name=tat]', form).forEach((c) => c.addEventListener('change', ligarEstilos));

  // o boneco muda na hora conforme as escolhas
  let previa = null;
  try {
    previa = mostrarModelo($('#previa', main), lerAparencia());
  } catch {
    $('#previa', main).hidden = true; // sem WebGL: o cadastro funciona do mesmo jeito
  }
  let espera;
  const atualizarPrevia = () => {
    clearTimeout(espera);
    espera = setTimeout(() => previa?.atualizar(lerAparencia()), 120);
  };
  form.addEventListener('input', atualizarPrevia);
  form.addEventListener('change', atualizarPrevia);
  window.addEventListener('hashchange', () => previa?.(), { once: true });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const dados = Object.fromEntries(fd);
    dados.cor_cabelo = cabelo(dados);
    dados.tatuagens = tatuagens(fd);
    Object.keys(dados).filter((k) => ['cabelo_cor', 'cabelo_tam', 'tat'].includes(k) || k.startsWith('tat_')).forEach((k) => delete dados[k]);
    if (dados.idade_estimada_min && dados.idade_estimada_max &&
        Number(dados.idade_estimada_min) > Number(dados.idade_estimada_max)) {
      return toast('A idade mínima está maior que a máxima.', 'erro');
    }
    dados.id_local = await local.valor();
    if (!dados.id_local) return;
    const botao = $('button[type=submit]', form);
    botao.disabled = true;
    try {
      const r = await api.post('/admin/corpos', dados);
      toast(`${r.codigo_iml} cadastrado e já está no mural.`, 'sucesso', 6000);
      location.hash = `#/admin/corpos/${r.id_corpo}`;
    } catch (e) {
      erroBanco(e);
      botao.disabled = false;
    }
  });
}

export async function ficha(main, [id], ctx) {
  const c = await api.get(`/admin/corpos/${id}`);
  const aberto = c.status === 'NAO_IDENTIFICADO';

  main.innerHTML = String(html`
    <section class="pagina">
      <a class="voltar" href="#/admin/corpos">← Câmara fria</a>
      <header class="pagina__topo">
        <div class="pagina__identidade"><div><h1 class="titulo">${c.codigo_iml}</h1>
            <p class="pagina__sub">${situacao(c)}</p></div></div>
        <div class="pagina__acoes">
          ${aberto
            ? html`<button class="btn btn--verde" id="identificar">Identificado</button>`
            : html`<button class="btn btn--fantasma" id="reabrir">Reabrir</button>`}
          <button class="btn btn--perigo" id="excluir">Excluir</button>
        </div>
      </header>
      ${aberto ? '' : html`<div class="faixa faixa--encerrado">IDENTIFICADO · fora do mural</div>`}

      <div class="duas-colunas">
        <div class="coluna">
          <section class="ficha ficha--previa">
            <div class="previa" id="previa" role="img" aria-label="Boneco do corpo"></div>
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Características</h2>
            <dl class="dados">
              <dt>Sexo</dt><dd>${SEXO[c.sexo]}</dd>
              <dt>Idade estimada</dt><dd>${c.idade_estimada_min != null ? `${c.idade_estimada_min} a ${c.idade_estimada_max ?? '?'} anos` : '—'}</dd>
              <dt>Altura</dt><dd>${c.altura_estimada_cm ? `${c.altura_estimada_cm} cm` : '—'}</dd>
              <dt>Aparência</dt><dd>${[c.cor_pele, c.cor_cabelo, c.cor_olhos].filter(Boolean).join(' · ') || '—'}</dd>
              <dt>Tatuagem</dt><dd>${rotuloTatuagens(c.tatuagens) || 'Nenhuma informada'}</dd>
              <dt>Detalhes</dt><dd>${c.caracteristicas || '—'}</dd>
            </dl>
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Entrada</h2>
            <dl class="dados">
              <dt>Local</dt><dd>${c.local_nome} · ${c.cidade}/${c.uf}</dd>
              <dt>Data</dt><dd>${data(c.data_encontrado)}</dd>
              <dt>Gaveta</dt><dd>${c.gaveta_camara || '—'}</dd>
              <dt>Observações</dt><dd>${c.observacoes || '—'}</dd>
            </dl>
          </section>
          ${c.objetos.length
            ? html`<section class="ficha"><h2 class="subtitulo">Objetos</h2>
                <ul class="radio">${c.objetos.map(
                  (o) => html`<li><a href="#/admin/objetos/${o.id_objeto}"><b>${o.titulo}</b></a> ${chip(o.status)}</li>`)}</ul>
              </section>`
            : ''}
        </div>
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Manifestações <small>(${c.manifestacoes.length})</small></h2>
            ${c.manifestacoes.length
              ? html`<div class="manifestacoes">${c.manifestacoes.map(cartaoManifestacao)}</div>`
              : html`<p class="vazio">Ninguém se manifestou ainda.</p>`}
          </section>
          <section class="ficha"><h2 class="subtitulo">Linha do tempo</h2>${linhaDoTempo(c.historico)}</section>
        </div>
      </div>
    </section>`);

  ligarAvaliacoes(main, ctx.recarregar);

  try {
    const boneco = mostrarModelo($('#previa', main), { ...c, tipo: 'corpo', id: c.id_corpo });
    window.addEventListener('hashchange', () => boneco(), { once: true });
  } catch {
    $('#previa', main).hidden = true;
  }

  const mudar = async (status, titulo, confirmar) => {
    const dados = await modalForm({
      titulo, confirmar,
      corpo: html`<label class="largo">Observação <textarea name="observacao" rows="3"
        placeholder="Como foi identificado…"></textarea></label>`,
    });
    if (!dados) return;
    try {
      await api.post(`/admin/corpos/${id}/status`, { status, observacao: dados.observacao });
      ctx.recarregar();
    } catch (e) {
      erroBanco(e);
    }
  };
  $('#excluir', main).addEventListener('click', async () => {
    if (!confirm(`Excluir ${c.codigo_iml} de vez? Manifestações e histórico também serão apagados.`)) return;
    try {
      await api.delete(`/admin/corpos/${id}`);
      toast('Corpo excluído.');
      location.hash = '#/admin/corpos';
    } catch (e) {
      erroBanco(e);
    }
  });
  $('#identificar', main)?.addEventListener('click', () =>
    mudar('IDENTIFICADO', 'Marcar corpo como identificado', 'Marcar como identificado'));
  $('#reabrir', main)?.addEventListener('click', () =>
    mudar('NAO_IDENTIFICADO', 'Reabrir (volta à contagem do mural)', 'Reabrir'));
}
