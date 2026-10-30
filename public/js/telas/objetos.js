import { api, carregarLocais } from '../api.js';
import {
  html, raw, $, $$, chip, data, toast, erroBanco, modalForm, opcoes, rotulo, linhaDoTempo,
  TIPOS_OBJETO, hoje,
} from '../ui.js';
import { seletorLocal, cartaoManifestacao, ligarAvaliacoes } from './comum.js';



export async function novo(main) {
  const locais = await carregarLocais();
  main.innerHTML = String(html`
    <section class="pagina">
      <a class="voltar" href="#/admin/objetos">← Estoque</a>
      <header class="pagina__topo"><div><h1 class="titulo">Cadastrar objeto</h1></div></header>
      <form id="form-objeto" class="ficha form">
        <div class="campos">
          <label>Tipo*<select name="tipo" required>${opcoes(TIPOS_OBJETO)}</select></label>
          <label class="largo">Título* <input name="titulo" required maxlength="100" placeholder="Celular Samsung preto"></label>
          <label class="largo">Descrição* <textarea name="descricao" required rows="3"
            placeholder="Marca, cor, inscrições…"></textarea></label>
          <label>Encontrado em* <input name="data_encontrado" type="date" required max="${hoje()}" value="${hoje()}"></label>
          <div class="largo" id="local"></div>
        </div>
        <footer class="form__acoes"><span class="espaco"></span>
          <button type="submit" class="btn btn--primario">Cadastrar</button></footer>
      </form>
    </section>`);

  const form = $('#form-objeto', main);
  const local = seletorLocal($('#local', main), locais, 'Local onde foi encontrado');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    dados.id_local = await local.valor();
    if (!dados.id_local) return;
    const botao = $('button[type=submit]', form);
    botao.disabled = true;
    try {
      const r = await api.post('/admin/objetos', dados);
      toast(`${r.codigo} cadastrado.`, 'sucesso');
      location.hash = `#/admin/objetos/${r.id_objeto}`;
    } catch (e) {
      erroBanco(e);
      botao.disabled = false;
    }
  });
}

export async function ficha(main, [id], ctx) {
  const o = await api.get(`/admin/objetos/${id}`);
  const aberto = o.status === 'EM_GUARDA';

  main.innerHTML = String(html`
    <section class="pagina">
      <a class="voltar" href="#/admin/objetos">← Estoque</a>
      <header class="pagina__topo">
        <div class="pagina__identidade"><div><h1 class="titulo">${o.titulo}</h1>
            <p class="pagina__sub">${o.codigo} · ${rotulo(o.tipo)} · ${chip(o.status)}</p></div></div>
        <div class="pagina__acoes">
          ${aberto
            ? html`<button class="btn btn--verde" id="devolver">Devolvido</button>`
            : html`<button class="btn btn--fantasma" id="reabrir">Reabrir</button>`}
          <button class="btn btn--perigo" id="excluir">Excluir</button>
        </div>
      </header>
      ${aberto ? '' : html`<div class="faixa faixa--encerrado">DEVOLVIDO · fora do mural</div>`}

      <div class="duas-colunas">
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Dados</h2>
            <dl class="dados">
              <dt>Descrição</dt><dd>${o.descricao}</dd>
              <dt>Local</dt><dd>${o.local_nome} · ${o.cidade}/${o.uf}</dd>
              <dt>Data</dt><dd>${data(o.data_encontrado)}</dd>
              ${o.codigo_iml ? html`<dt>Corpo de origem</dt><dd><a href="#/admin/corpos/${o.id_corpo}">${o.codigo_iml}</a></dd>` : ''}
            </dl>
          </section>
        </div>
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Manifestações <small>(${o.manifestacoes.length})</small></h2>
            ${o.manifestacoes.length
              ? html`<div class="manifestacoes">${o.manifestacoes.map(cartaoManifestacao)}</div>`
              : html`<p class="vazio">Ninguém se manifestou ainda.</p>`}
          </section>
          <section class="ficha"><h2 class="subtitulo">Linha do tempo</h2>${linhaDoTempo(o.historico)}</section>
        </div>
      </div>
    </section>`);

  ligarAvaliacoes(main, ctx.recarregar);

  const mudar = async (status, titulo, confirmar) => {
    const dados = await modalForm({
      titulo, confirmar,
      corpo: html`<label class="largo">Observação <textarea name="observacao" rows="3"
        placeholder="Quem retirou, documento conferido…"></textarea></label>`,
    });
    if (!dados) return;
    try {
      await api.post(`/admin/objetos/${id}/status`, { status, observacao: dados.observacao });
      ctx.recarregar();
    } catch (e) {
      erroBanco(e);
    }
  };
  $('#excluir', main).addEventListener('click', async () => {
    if (!confirm(`Excluir "${o.titulo}" de vez? Manifestações e histórico também serão apagados.`)) return;
    try {
      await api.delete(`/admin/objetos/${id}`);
      toast('Objeto excluído.');
      location.hash = '#/admin/objetos';
    } catch (e) {
      erroBanco(e);
    }
  });
  $('#devolver', main)?.addEventListener('click', () =>
    mudar('DEVOLVIDO', 'Marcar objeto como devolvido', 'Marcar como devolvido'));
  $('#reabrir', main)?.addEventListener('click', () =>
    mudar('EM_GUARDA', 'Reabrir objeto (volta ao mural)', 'Reabrir'));
}
