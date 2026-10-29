// Componentes de formulário compartilhados pelas telas de cadastro
import { api, carregarDominios } from '../api.js';
import { html, $, opcoes, toast, erroBanco, TIPOS_LOCAL } from '../ui.js';

const NOVO = '__novo__';

// Select de local com opção de cadastrar um novo na hora.
// valor() devolve o id_local (criando o local se preciso), null se vazio
// ou undefined se o novo local estiver incompleto.
export function seletorLocal(raiz, dominios, rotuloCampo, obrigatorio = false) {
  raiz.innerHTML = String(html`
    <label>${rotuloCampo}${obrigatorio ? '*' : ''}
      <select name="_local" ${obrigatorio ? 'required' : ''}>
        <option value="">${obrigatorio ? '— escolha —' : '— não informado —'}</option>
        ${dominios.locais.map((l) => html`<option value="${l.id_local}">${l.nome} · ${l.cidade}/${l.uf}</option>`)}
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
        const local = await api.post('/locais', {
          nome: campo('nome'), tipo_local: campo('tipo_local'), bairro: campo('bairro'),
          cidade: campo('cidade'), uf: campo('uf'),
        });
        await carregarDominios(true);
        return local.id_local;
      } catch (e) {
        erroBanco(e);
        return undefined;
      }
    },
  };
}
