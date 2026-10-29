// Editor de sinais particulares (boneco + lista), usado nos cadastros de desaparecido e de corpo
import { html, raw, $, modalForm, opcoes, rotulo } from './ui.js';
import { boneco, ligarBoneco } from './boneco.js';

const LADOS = ['DIREITO', 'ESQUERDO', 'CENTRAL', 'BILATERAL'];

export function listaSinais(sinais, { removivel = false, destaque = new Set() } = {}) {
  if (!sinais.length) return html`<p class="vazio">Nenhum sinal particular registrado.</p>`;
  return html`<ul class="sinais">
    ${sinais.map(
      (s, i) => html`<li class="${raw(destaque.has(s.id_sinal) ? 'sinais--coincide' : '')}">
        <span class="sinais__tipo">${s.tipo}</span>
        <span><b>${s.regiao}</b>${s.lado && s.lado !== 'CENTRAL' ? ` (${rotulo(s.lado)})` : ''}: ${s.descricao}${s.cor ? ` · ${s.cor}` : ''}</span>
        ${destaque.has(s.id_sinal) ? html`<span class="sinais__match" title="Coincide com o outro lado">✓ bateu</span>` : ''}
        ${removivel ? html`<button type="button" class="btn-icone" data-remover="${i}" aria-label="Remover sinal">✕</button>` : ''}
      </li>`
    )}
  </ul>`;
}

export const marcasDe = (sinais, classe = 'marcado') =>
  sinais.map((s) => ({ regiao: s.regiao, lado: s.lado, classe }));

// Monta o editor em `raiz`; devolve um getter com os sinais no formato da API
export function editorSinais(raiz, dominios) {
  const sinais = [];
  const idRegiao = Object.fromEntries(dominios.regioes.map((r) => [r.descricao, r.id_regiao]));

  const desenhar = () => {
    raiz.innerHTML = String(html`
      <div class="editor-sinais">
        <div>${boneco({ interativo: true, marcas: marcasDe(sinais) })}</div>
        <div>
          <h3 class="subtitulo">Sinais anotados (${sinais.length})</h3>
          ${listaSinais(sinais, { removivel: true })}
          <p class="dica">Tatuagens, cicatrizes, próteses, piercings… Cada sinal padronizado vale pontos no cruzamento.</p>
        </div>
      </div>`);
    ligarBoneco(raiz, adicionar);
    raiz.querySelectorAll('[data-remover]').forEach((b) =>
      b.addEventListener('click', () => {
        sinais.splice(Number(b.dataset.remover), 1);
        desenhar();
      })
    );
  };

  async function adicionar(regiao, lado) {
    const dados = await modalForm({
      titulo: `Novo sinal: ${regiao}`,
      confirmar: 'Anotar sinal',
      corpo: html`
        <div class="campos">
          <label>Tipo de sinal
            <select name="id_tipo_sinal" required>
              ${dominios.tipos_sinal.map((t) => html`<option value="${t.id_tipo_sinal}">${t.descricao}</option>`)}
            </select></label>
          <label>Lado
            <select name="lado">${opcoes(LADOS, lado)}</select></label>
          <label class="largo">Descrição
            <input name="descricao" required maxlength="500" placeholder='ex.: rosa com o nome "Ana"'></label>
          <label>Cor <input name="cor" maxlength="30" placeholder="opcional"></label>
          <label>Tamanho (cm) <input name="tamanho_cm" type="number" step="0.1" min="0" placeholder="opcional"></label>
        </div>`,
    });
    if (!dados) return;
    const tipo = dominios.tipos_sinal.find((t) => t.id_tipo_sinal === Number(dados.id_tipo_sinal));
    sinais.push({ ...dados, id_tipo_sinal: Number(dados.id_tipo_sinal), id_regiao: idRegiao[regiao],
                  regiao, tipo: tipo.descricao });
    desenhar();
    $('.sinais li:last-child', raiz)?.classList.add('novo');
  }

  desenhar();
  return () => sinais.map(({ regiao, tipo, ...s }) => s);
}
