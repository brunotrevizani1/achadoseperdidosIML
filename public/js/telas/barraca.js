// Tela inicial pública: a barraca de achados e perdidos em 3D, em tela cheia
import { api } from '../api.js';
import { Barraca3D } from '../tres/barraca3d.js';
import { mostrarModelo } from '../tres/visor3d.js';
import {
  html, $, data, toast, erroBanco, modalForm, opcoes, rotulo, PARENTESCOS, SEXO,
} from '../ui.js';

const ATUALIZAR_A_CADA_MS = 15000;
const DURACAO_GIRO_MS = 550;

const temWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------
// Item aberto em tela grande: o desenho à esquerda, as informações à direita
// ---------------------------------------------------------------------
function visor(item) {
  const eObjeto = item.tipo === 'objeto';
  const dado = (rot, v) => (v ? html`<dt>${rot}</dt><dd>${v}</dd>` : '');
  const dlg = document.createElement('dialog');
  dlg.className = 'visor';
  dlg.innerHTML = String(html`
    <button type="button" class="visor__fechar" data-fechar aria-label="Fechar">✕</button>
    <div class="visor__figura" id="figura3d"></div>
    <div class="visor__info">
      <small class="visor__tipo">${eObjeto ? rotulo(item.categoria) : 'Pessoa não identificada'}</small>
      <h2>${item.titulo}</h2>
      ${eObjeto
        ? html`<p>${item.descricao}</p>`
        : html`<dl class="dados">
            ${dado('Sexo', SEXO[item.sexo])}
            ${dado('Idade', item.idade)}
            ${dado('Altura', item.altura_cm && `${item.altura_cm} cm`)}
            ${dado('Pele', item.cor_pele)}
            ${dado('Cabelo', item.cor_cabelo)}
            ${dado('Olhos', item.cor_olhos)}
          </dl>
          ${item.caracteristicas ? html`<p>${item.caracteristicas}</p>` : ''}`}
      <dl class="dados">
        ${dado('Local', item.local)}
        ${dado('Bairro', item.bairro)}
        ${dado('Cidade', `${item.cidade}/${item.uf}`)}
        ${dado('Encontrado em', data(item.data_encontrado))}
      </dl>
      <button type="button" class="btn btn--primario btn--grande" id="conheco">Eu conheço / é meu</button>
    </div>`);
  document.body.append(dlg);
  $('[data-fechar]', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
  let encerrar = () => {};
  dlg.addEventListener('close', () => {
    encerrar();
    dlg.remove();
  });
  $('#conheco', dlg).addEventListener('click', () => manifestar(item));
  dlg.showModal();
  if (temWebGL()) encerrar = mostrarModelo($('#figura3d', dlg), item);
  else $('#figura3d', dlg).hidden = true;
}

// ---------------------------------------------------------------------
// "Eu conheço / é meu"
// ---------------------------------------------------------------------
async function manifestar(item) {
  const eObjeto = item.tipo === 'objeto';
  const dados = await modalForm({
    titulo: eObjeto ? 'Este objeto é meu / eu conheço' : 'Eu conheço esta pessoa',
    confirmar: 'Enviar para o IML',
    corpo: html`
      <p class="dica">Sua mensagem vai para a equipe do IML, que entrará em contato. Seu contato <b>não</b> aparece no mural.</p>
      <div class="campos">
        <label class="largo">Seu nome* <input name="nome" required maxlength="120" autocomplete="name"></label>
        <label>Telefone ou e-mail* <input name="contato" required maxlength="120" autocomplete="tel"></label>
        <label>${eObjeto ? 'Sua relação com o dono' : 'Sua relação com a pessoa'}*
          <select name="parentesco" required><option value="">— escolha —</option>${opcoes(PARENTESCOS)}</select></label>
        <label class="largo">O que você reconheceu?*
          <textarea name="o_que_reconheceu" required rows="4"
            placeholder="${eObjeto ? 'Ex.: a gravação na aliança, a capinha do celular, onde comprou…' : 'Ex.: tatuagem, cicatriz, roupa, quando e onde viu a pessoa pela última vez…'}"></textarea></label>
      </div>`,
  });
  if (!dados) return;
  try {
    await api.post('/manifestacoes', { tipo: item.tipo, id: item.id, ...dados });
    toast('Recebemos sua mensagem. A equipe do IML vai entrar em contato.', 'sucesso', 7000);
  } catch (e) {
    erroBanco(e);
  }
}

// ---------------------------------------------------------------------
export async function render(main) {
  main.innerHTML = String(html`
    <section class="barraca-pagina">
      <h1 class="so-leitor">Barraca de achados e perdidos</h1>
      <div class="barraca" id="barraca" role="region" aria-label="Barraca de achados e perdidos">
        <div class="barraca__dica">Passe o mouse e clique em um item para vê-lo de perto</div>
        <div class="barraca__nome" id="nome" hidden></div>
        <ul class="so-leitor" id="alternativa" aria-label="Itens da barraca"></ul>
      </div>
    </section>`);

  const raiz = $('#barraca', main);
  const nome = $('#nome', main);
  const alternativa = $('#alternativa', main);
  let itens = [];

  // Os botões escondidos servem a quem usa teclado ou leitor de tela, e se o WebGL falhar
  const listarAlternativa = () => {
    alternativa.innerHTML = String(html`${itens.map(
      (i, k) => html`<li><button type="button" data-k="${k}">${i.tipo === 'objeto' ? rotulo(i.categoria) : 'Pessoa não identificada'}: ${i.titulo}</button></li>`
    )}`);
  };
  alternativa.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-k]');
    if (b) visor(itens[Number(b.dataset.k)]);
  });

  if (!temWebGL()) {
    raiz.classList.add('barraca--sem3d');
    raiz.insertAdjacentHTML('afterbegin', '<p class="barraca__aviso">Seu navegador não conseguiu abrir a barraca em 3D. Escolha um item abaixo.</p>');
    alternativa.classList.remove('so-leitor');
    itens = await api.get('/mural');
    listarAlternativa();
    return;
  }

  await document.fonts.load('700 44px Fredoka').catch(() => {});
  const cena = new Barraca3D(raiz, {
    aoPassar: (item, x, y) => {
      nome.hidden = !item;
      if (!item) return;
      nome.textContent = item.titulo;
      nome.style.left = `${x}px`;
      nome.style.top = `${y}px`;
    },
    aoClicar: async (item) => {
      nome.hidden = true;
      await cena.girar(`${item.tipo}-${item.id}`, DURACAO_GIRO_MS);
      visor(item);
    },
  });
  const atualizar = async () => {
    itens = await api.get('/mural');
    cena.atualizar(itens);
    listarAlternativa();
  };
  await atualizar();

  // Itens cadastrados depois aparecem sozinhos; tudo para quando a pessoa sai desta tela
  let ativa = true;
  const encerrar = () => {
    if (!ativa || raiz.isConnected) return;
    ativa = false;
    clearInterval(timer);
    cena.destruir();
  };
  const timer = setInterval(() => {
    encerrar();
    if (ativa) atualizar().catch(() => {});
  }, ATUALIZAR_A_CADA_MS);
  window.addEventListener('hashchange', () => setTimeout(encerrar, 200), { once: true });
}
