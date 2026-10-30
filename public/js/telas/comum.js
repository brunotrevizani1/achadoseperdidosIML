// Componentes compartilhados pelas telas de administrador
import { api, carregarLocais } from '../api.js';
import { html, raw, $, $$, opcoes, toast, erroBanco, modalForm, chip, rotulo, dataHora, TIPOS_LOCAL } from '../ui.js';
import { chaveMini, preencherMiniaturas } from '../tres/miniaturas.js';

const NOVO = '__novo__';

// Select de local com opção de cadastrar um novo na hora.
// valor() devolve o id_local (criando o local se preciso), null se vazio
// ou undefined se o novo local estiver incompleto.
export function seletorLocal(raiz, locais, rotuloCampo) {
  raiz.innerHTML = String(html`
    <label>${rotuloCampo}*
      <select name="_local" required>
        <option value="">— escolha —</option>
        ${locais.map((l) => html`<option value="${l.id_local}">${l.nome} · ${l.cidade}/${l.uf}</option>`)}
        <option value="${NOVO}">+ Cadastrar novo local…</option>
      </select></label>
    <div class="campos novo-local" hidden>
      <label class="largo">Nome do local* <input data-l="nome" maxlength="120" placeholder='ex.: "Rodoviária"'></label>
      <label>Tipo <select data-l="tipo_local"><option value="">—</option>${opcoes(TIPOS_LOCAL)}</select></label>
      <label>Bairro <input data-l="bairro" maxlength="80"></label>
      <label>Cidade* <input data-l="cidade" maxlength="80"></label>
      <label>UF* <input data-l="uf" maxlength="2" size="2" placeholder="RS"></label>
    </div>`);
  const select = $('select[name=_local]', raiz);
  const novo = $('.novo-local', raiz);
  select.addEventListener('change', () => (novo.hidden = select.value !== NOVO));

  return {
    async valor() {
      if (select.value !== NOVO) return select.value ? Number(select.value) : null;
      const campo = (k) => $(`[data-l=${k}]`, novo).value.trim();
      if (!campo('nome') || !campo('cidade') || campo('uf').length !== 2) {
        toast('Novo local: preencha nome, cidade e UF (2 letras).', 'erro');
        $('[data-l=nome]', novo).focus();
        return undefined;
      }
      try {
        const local = await api.post('/admin/locais', {
          nome: campo('nome'), tipo_local: campo('tipo_local'), bairro: campo('bairro'),
          cidade: campo('cidade'), uf: campo('uf'),
        });
        await carregarLocais(true);
        return local.id_local;
      } catch (e) {
        erroBanco(e);
        return undefined;
      }
    },
  };
}

// ---------------------------------------------------------------------
// Manifestações ("Eu conheço / é meu")
// ---------------------------------------------------------------------
export function cartaoManifestacao(m) {
  const aberta = ['RECEBIDA', 'EM_ANALISE'].includes(m.status);
  const item = m.e_objeto
    ? { tipo: 'objeto', id: m.id_objeto, categoria: m.categoria }
    : { ...m, tipo: 'corpo', id: m.id_corpo, codigo: m.codigo_item };
  return html`<article class="manifestacao manifestacao--${m.status.toLowerCase()} ${raw(m.item ? 'manifestacao--mini' : '')}">
    ${m.item ? html`<div class="manifestacao__figura"><img class="mini" alt="" data-mini="${chaveMini(item)}"></div>` : ''}
    <div class="manifestacao__conteudo">
      <header>
        <b>${m.nome}</b> <span class="etiqueta__gaveta">${rotulo(m.parentesco)}</span> ${chip(m.status)}
        <small>${dataHora(m.criado_em)}</small>
      </header>
      ${m.item ? html`<p class="manifestacao__item"><a href="#/admin/${m.e_objeto ? 'objetos' : 'corpos'}/${m.id_objeto || m.id_corpo}">
        <b>${m.item}</b></a> (${m.codigo_item})</p>` : ''}
      <blockquote>${m.o_que_reconheceu}</blockquote>
      <p class="manifestacao__contato">${m.contato}</p>
      ${m.parecer ? html`<p class="manifestacao__parecer"><b>Parecer${m.avaliador ? ` de ${m.avaliador}` : ''}:</b> ${m.parecer}</p>` : ''}
      ${aberta
        ? html`<footer class="manifestacao__acoes">
            ${m.status === 'RECEBIDA' ? html`<button class="btn btn--pequeno" data-avaliar="EM_ANALISE" data-id="${m.id_manifestacao}">Em análise</button>` : ''}
            <button class="btn btn--pequeno btn--verde" data-avaliar="ACEITA" data-id="${m.id_manifestacao}"
              data-eobjeto="${m.id_objeto ? '1' : ''}">Aceitar</button>
            <button class="btn btn--pequeno btn--perigo" data-avaliar="RECUSADA" data-id="${m.id_manifestacao}">Recusar</button>
          </footer>`
        : ''}
    </div>
  </article>`;
}

// Liga os botões dos cartões acima. aoMudar() é chamado depois de cada avaliação.
export function ligarAvaliacoes(raiz, aoMudar) {
  preencherMiniaturas(raiz);
  $$('[data-avaliar]', raiz).forEach((b) =>
    b.addEventListener('click', async () => {
      const decisao = b.dataset.avaliar;
      let parecer = '';
      if (decisao !== 'EM_ANALISE') {
        const eObjeto = !!b.dataset.eobjeto;
        const dados = await modalForm({
          titulo: decisao === 'ACEITA' ? 'Aceitar manifestação' : 'Recusar manifestação',
          confirmar: decisao === 'ACEITA' ? (eObjeto ? 'Aceitar e marcar como devolvido' : 'Aceitar e marcar como identificado') : 'Recusar',
          corpo: html`
            ${decisao === 'ACEITA'
              ? html`<p class="dica">O item sai do mural.</p>` : ''}
            <label class="largo">Parecer*
              <textarea name="parecer" required rows="4"
                placeholder="${decisao === 'ACEITA' ? 'Como a pessoa foi confirmada (documento, conferência…)' : 'Por que não procede'}"></textarea></label>`,
        });
        if (!dados) return;
        parecer = dados.parecer;
      }
      try {
        await api.post(`/admin/manifestacoes/${b.dataset.id}/avaliar`, { decisao, parecer });
        toast(decisao === 'ACEITA' ? 'Manifestação aceita.' : decisao === 'RECUSADA' ? 'Manifestação recusada.' : 'Marcada em análise.');
        aoMudar();
      } catch (e) {
        erroBanco(e);
      }
    })
  );
}

