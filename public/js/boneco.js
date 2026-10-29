// Boneco SVG clicável: escolhe a região do corpo (tabela regiao_corpo) e o lado.
// A figura está de frente para quem olha: o lado esquerdo da tela é o DIREITO da pessoa.
import { html, raw, $$ } from './ui.js';

// [regiao, lado, forma SVG]
const PARTES = [
  ['Cabeça', 'CENTRAL', '<ellipse cx="100" cy="30" rx="25" ry="27"/>'],
  ['Rosto', 'CENTRAL', '<ellipse cx="100" cy="40" rx="16" ry="15"/>'],
  ['Pescoço', 'CENTRAL', '<rect x="90" y="57" width="20" height="16" rx="4"/>'],
  ['Ombro', 'DIREITO', '<ellipse cx="64" cy="84" rx="15" ry="10"/>'],
  ['Ombro', 'ESQUERDO', '<ellipse cx="136" cy="84" rx="15" ry="10"/>'],
  ['Tórax', 'CENTRAL', '<rect x="72" y="76" width="56" height="52" rx="10"/>'],
  ['Abdômen', 'CENTRAL', '<rect x="74" y="128" width="52" height="42" rx="8"/>'],
  ['Quadril', 'CENTRAL', '<rect x="72" y="170" width="56" height="26" rx="8"/>'],
  ['Braço', 'DIREITO', '<rect x="44" y="94" width="19" height="54" rx="9"/>'],
  ['Braço', 'ESQUERDO', '<rect x="137" y="94" width="19" height="54" rx="9"/>'],
  ['Antebraço', 'DIREITO', '<rect x="38" y="150" width="19" height="50" rx="9"/>'],
  ['Antebraço', 'ESQUERDO', '<rect x="143" y="150" width="19" height="50" rx="9"/>'],
  ['Punho', 'DIREITO', '<rect x="36" y="201" width="18" height="10" rx="4"/>'],
  ['Punho', 'ESQUERDO', '<rect x="146" y="201" width="18" height="10" rx="4"/>'],
  ['Mão', 'DIREITO', '<ellipse cx="44" cy="226" rx="11" ry="14"/>'],
  ['Mão', 'ESQUERDO', '<ellipse cx="156" cy="226" rx="11" ry="14"/>'],
  ['Coxa', 'DIREITO', '<rect x="74" y="197" width="25" height="64" rx="10"/>'],
  ['Coxa', 'ESQUERDO', '<rect x="101" y="197" width="25" height="64" rx="10"/>'],
  ['Joelho', 'DIREITO', '<ellipse cx="86" cy="270" rx="12" ry="9"/>'],
  ['Joelho', 'ESQUERDO', '<ellipse cx="114" cy="270" rx="12" ry="9"/>'],
  ['Perna', 'DIREITO', '<rect x="76" y="280" width="21" height="68" rx="9"/>'],
  ['Perna', 'ESQUERDO', '<rect x="103" y="280" width="21" height="68" rx="9"/>'],
  ['Tornozelo', 'DIREITO', '<rect x="77" y="349" width="18" height="10" rx="4"/>'],
  ['Tornozelo', 'ESQUERDO', '<rect x="105" y="349" width="18" height="10" rx="4"/>'],
  ['Pé', 'DIREITO', '<ellipse cx="82" cy="370" rx="14" ry="8"/>'],
  ['Pé', 'ESQUERDO', '<ellipse cx="118" cy="370" rx="14" ry="8"/>'],
];
// Regiões que não aparecem bem na vista de frente
const EXTRAS = ['Costas', 'Glúteo', 'Boca / Arcada dentária'];

const nomeLado = { DIREITO: 'lado direito', ESQUERDO: 'lado esquerdo', CENTRAL: '', BILATERAL: 'bilateral' };

// marcas: [{ regiao, lado, classe }] para destacar sinais já cadastrados
export function boneco({ marcas = [], interativo = false, titulo = 'Mapa do corpo' } = {}) {
  const classeDa = (regiao, lado) => {
    const m = marcas.filter((x) => x.regiao === regiao && (x.lado === lado || !x.lado || x.lado === 'BILATERAL'
      || lado === 'CENTRAL' || x.lado === 'CENTRAL'));
    return m.map((x) => x.classe || 'marcado').join(' ');
  };
  const partes = PARTES.map(([regiao, lado, forma]) => {
    const rot = `${regiao} ${nomeLado[lado]}`.trim();
    const attrs = interativo ? `tabindex="0" role="button" aria-label="${rot}"` : '';
    return `<g class="boneco__parte ${classeDa(regiao, lado)}" data-regiao="${regiao}" data-lado="${lado}" ${attrs}>
      <title>${rot}</title>${forma}</g>`;
  }).join('');

  const extras = EXTRAS.map((regiao) => {
    const classe = classeDa(regiao, 'CENTRAL');
    return interativo
      ? html`<button type="button" class="boneco__extra ${raw(classe)}" data-regiao="${regiao}" data-lado="CENTRAL">${regiao}</button>`
      : classe
        ? html`<span class="boneco__extra ${raw(classe)}">${regiao}</span>`
        : '';
  });

  return html`<figure class="boneco ${raw(interativo ? 'boneco--interativo' : '')}">
    <svg viewBox="0 0 200 385" aria-label="${titulo}">${raw(partes)}</svg>
    <figcaption>
      <div class="boneco__extras">${extras}</div>
      ${interativo ? html`<small>Clique na região. O lado esquerdo da tela é o lado <b>direito</b> da pessoa.</small>` : ''}
    </figcaption>
  </figure>`;
}

// Liga os cliques do boneco interativo dentro de `raiz`
export function ligarBoneco(raiz, aoEscolher) {
  $$('[data-regiao]', raiz).forEach((el) => {
    const escolher = () => aoEscolher(el.dataset.regiao, el.dataset.lado, el);
    el.addEventListener('click', escolher);
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        escolher();
      }
    });
  });
}
