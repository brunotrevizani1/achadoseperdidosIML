// Sala do administrador: o cenário 3D e a janela por cima, onde abrem o painel, o estoque e as manifestações
import { api } from '../api.js';
import { html, $, rotulo } from '../ui.js';
import { Sala3D } from '../tres/sala3d.js';
import { transicao, fadeOpaco, fadeLimpo } from './transicao.js';

let atual = null;

const TITULOS = { tv: 'Painel', estoque: 'Estoque · objetos', camara: 'Câmara fria · corpos', pasta: 'Manifestações' };

const temWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

// Monta a sala uma vez e a reaproveita enquanto a pessoa navega entre as telas do administrador
export async function garantirSala(main, ctx) {
  if (atual && atual.raiz.isConnected) return atual;

  main.innerHTML = String(html`
    <section class="barraca-pagina">
      <h1 class="so-leitor">Sala do administrador</h1>
      <div class="barraca sala" id="sala" role="region" aria-label="Sala do administrador em 3D">
        <div class="sala__cena" id="sala3d"></div>
        <div class="barraca__nome" id="rotulo-sala" hidden></div>
        <div class="barraca__dica">Clique na TV, nas prateleiras, na câmara fria ou na pasta sobre a mesa</div>
        <ul class="so-leitor sala__atalhos" id="atalhos"></ul>
        <div class="sala__janela" id="janela" hidden>
          <article class="janela" id="janela-caixa">
            <header class="janela__topo">
              <span class="janela__luz" aria-hidden="true"></span>
              <span class="janela__titulo" id="janela-titulo"></span>
              <a class="janela__fechar" href="#/admin">✕ Voltar à sala</a>
            </header>
            <div class="janela__corpo" id="janela-corpo"></div>
          </article>
        </div>
      </div>
    </section>`);

  const raiz = $('#sala', main);
  const rotuloEl = $('#rotulo-sala', raiz);
  const janela = $('#janela', raiz);
  const caixa = $('#janela-caixa', raiz);
  const corpo = $('#janela-corpo', raiz);
  const atalhos = $('#atalhos', raiz);

  const ir = async ({ acao, destino }) => {
    rotuloEl.hidden = true;
    if (acao === 'sair') return sair();
    if (acao === 'pasta') await sala.cena?.abrirPasta();
    location.hash = destino;
  };

  // A única saída é a porta: a câmera avança até ela, a sessão termina e a recepção começa do outro lado
  let saindo = false;
  const sair = async () => {
    if (saindo) return; // cliques repetidos na porta
    saindo = true;
    if (sala.cena) await Promise.all([sala.cena.abrirPorta(650), sala.cena.zoomPorta(true, 950)]);
    await fadeOpaco();
    transicao.intro = true;
    await ctx.sair();
  };

  const sala = { raiz, cena: null };

  // quem não tem WebGL navega por botões (e quem usa teclado também chega aos mesmos destinos)
  const ATALHOS = [
    ['Painel (TV)', '#/admin/painel'], ['Estoque · objetos', '#/admin/objetos'],
    ['Estoque · corpos', '#/admin/corpos'], ['Manifestações', '#/admin/manifestacoes'],
  ];
  atalhos.innerHTML = String(html`${ATALHOS.map(([nome, destino]) => html`<li><a href="${destino}">${nome}</a></li>`)}`);

  if (temWebGL()) {
    try {
      sala.cena = new Sala3D($('#sala3d', raiz), {
        aoPassar: (texto, x, y) => {
          rotuloEl.hidden = !texto;
          if (!texto) return;
          rotuloEl.textContent = texto;
          rotuloEl.style.left = `${x}px`;
          rotuloEl.style.top = `${y}px`;
        },
        aoClicar: ir,
      });
    } catch {
      sala.cena = null;
    }
  }
  if (!sala.cena) {
    raiz.classList.add('barraca--sem3d');
    atalhos.classList.remove('so-leitor');
    atalhos.insertAdjacentHTML('beforeend', '<li><a href="#/" id="sair-alternativo">Sair para a recepção</a></li>');
    $('#sair-alternativo', raiz).addEventListener('click', (e) => {
      e.preventDefault();
      sair();
    });
  }

  // Abre a janela com o tema do que foi clicado: TV (painel), estoque (arquivo) ou pasta (manifestações)
  sala.abrirJanela = (tipo) => {
    caixa.className = `janela janela--${tipo}`;
    $('#janela-titulo', raiz).textContent = TITULOS[tipo];
    janela.hidden = false;
    corpo.scrollTop = 0;
    sala.cena?.pausar(true); // a sala fica parada atrás da janela
    if (tipo === 'pasta') sala.cena?.abrirPasta();
    return corpo;
  };
  sala.fecharJanela = () => {
    janela.hidden = true;
    corpo.innerHTML = '';
    sala.cena?.fecharPasta();
    sala.cena?.pausar(false);
  };

  // Números da TV e selo da pasta
  sala.atualizar = async () => {
    try {
      const [p, corpos] = await Promise.all([api.get('/admin/painel'), api.get('/admin/corpos')]);
      const soma = (grupo, ...ks) => ks.reduce((t, k) => t + (p[grupo][k] || 0), 0);
      const gavetas = corpos.filter((c) => c.status === 'NAO_IDENTIFICADO').length;
      const fila = soma('manifestacoes', 'RECEBIDA', 'EM_ANALISE');
      sala.cena?.atualizarTV({
        fila,
        objetos: soma('objetos', 'EM_GUARDA', 'DEVOLVIDO'),
        corpos: soma('corpos', 'NAO_IDENTIFICADO', 'IDENTIFICADO'),
        manifestacoes: soma('manifestacoes', 'RECEBIDA', 'EM_ANALISE', 'ACEITA', 'RECUSADA'),
        gavetas,
        capacidade: Math.max(3, Math.ceil(gavetas / 4)) * 4,
        eventos: p.eventos.map((e) => `${e.rotulo} → ${rotulo(e.status_novo)}`),
      });
      sala.cena?.atualizarPendentes(fila);
    } catch {
      /* a sala continua utilizável sem os números */
    }
  };

  // Esc fecha a janela e volta para a sala
  const teclado = (e) => {
    if (!raiz.isConnected) return document.removeEventListener('keydown', teclado);
    if (e.key === 'Escape' && !janela.hidden && !document.querySelector('dialog[open]')) location.hash = '#/admin';
  };
  document.addEventListener('keydown', teclado);

  atual = sala;
  sala.atualizar();
  await sala.cena?.pronta; // a cena compila em segundo plano; a tela fica esmaecida até lá
  if (transicao.intro && sala.cena) { // veio da recepção pela porta: a câmera começa colada nela e se afasta
    transicao.intro = false;
    sala.cena.introEntrada();
  }
  transicao.intro = false;
  fadeLimpo();
  return sala;
}
