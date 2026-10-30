// Passagem entre a recepção e a sala: depois do zoom na porta a tela esmaece, e a cena seguinte começa colada na porta
export const transicao = { intro: false };

const painel = () => document.getElementById('fade');

// resolve quando a tela já está coberta
let seguranca = null;

export function fadeOpaco() {
  painel()?.classList.add('ativo');
  clearTimeout(seguranca);
  seguranca = setTimeout(fadeLimpo, 4000); // por garantia: a tela nunca fica coberta para sempre
  return new Promise((resolve) => setTimeout(resolve, 220));
}

export function fadeLimpo() {
  painel()?.classList.remove('ativo');
}
