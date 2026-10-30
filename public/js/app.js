// Roteador da SPA e sessão do usuário
import { api } from './api.js';
import { html, $, toast } from './ui.js';
import * as barraca from './telas/barraca.js';
import * as painel from './telas/painel.js';
import * as estoque from './telas/estoque.js';
import * as objetos from './telas/objetos.js';
import * as corpos from './telas/corpos.js';
import * as manifestacoes from './telas/manifestacoes.js';
import { garantirSala } from './telas/sala.js';
import { fadeLimpo } from './telas/transicao.js';

// [regex, tela, exige login, janela da sala em que a tela abre]
// A recepção e a sala são cenários em 3D; as telas do administrador abrem numa janela por cima da sala:
// o painel numa TV (tv), os objetos no estoque (estoque), os corpos na câmara fria (camara) e as manifestações numa pasta (pasta).
const ROTAS = [
  [/^\/?$/, barraca.render, false],
  [/^\/entrar$/, barraca.render, false], // a recepção, já com o painel de acesso aberto
  [/^\/admin\/?$/, null, true, null], // só a sala
  [/^\/admin\/painel$/, painel.render, true, 'tv'],
  [/^\/admin\/(estoque|objetos)$/, estoque.lista, true, 'estoque'],
  [/^\/admin\/corpos$/, estoque.lista, true, 'camara'],
  [/^\/admin\/objetos\/novo$/, objetos.novo, true, 'estoque'],
  [/^\/admin\/objetos\/(\d+)$/, objetos.ficha, true, 'estoque'],
  [/^\/admin\/corpos\/novo$/, corpos.novo, true, 'camara'],
  [/^\/admin\/corpos\/(\d+)$/, corpos.ficha, true, 'camara'],
  [/^\/admin\/manifestacoes$/, manifestacoes.lista, true, 'pasta'],
];

const ctx = {
  usuario: null,
  recarregar: () => navegar(),
  entrou: (usuario) => {
    definirUsuario(usuario);
    location.hash = '#/admin';
  },
  sair: async () => {
    await api.post('/logout').catch(() => {});
    definirUsuario(null);
    location.hash = '#/';
  },
};

const main = $('#conteudo');

async function navegar() {
  const caminho = location.hash.replace(/^#/, '') || '/';
  const rota = ROTAS.find(([re]) => re.test(caminho));
  const admin = !!(rota && rota[2]);
  document.body.classList.toggle('admin', admin);
  document.body.classList.toggle('barraca-tela', !!rota); // recepção e sala ocupam a janela toda

  if (!rota) {
    main.innerHTML = String(html`<section class="pagina vazio-grande">
      <h1 class="titulo">404</h1><p>Página não encontrada.</p>
      <a class="btn" href="#/">Voltar à recepção</a></section>`);
    return;
  }
  if (admin && !ctx.usuario) {
    location.hash = '#/entrar';
    return;
  }
  const params = caminho.match(rota[0]).slice(1);
  try {
    if (!admin) {
      main.innerHTML = '<div class="carregando" role="status">Carregando…</div>';
      await rota[1](main, params, ctx);
    } else {
      const sala = await garantirSala(main, ctx);
      if (rota[3]) {
        const alvo = sala.abrirJanela(rota[3]);
        alvo.innerHTML = '<div class="carregando" role="status">Carregando…</div>';
        await rota[1](alvo, params, ctx);
      } else {
        sala.fecharJanela();
        sala.atualizar();
      }
    }
  } catch (e) {
    fadeLimpo();
    if (e.status === 401) return;
    main.innerHTML = String(html`<section class="pagina vazio-grande">
      <h1 class="titulo">Ops.</h1><p>${e.message}</p><a class="btn" href="#/">Voltar à recepção</a></section>`);
  }
  window.scrollTo(0, 0);
}

function definirUsuario(usuario) {
  ctx.usuario = usuario;
}

window.addEventListener('hashchange', navegar);
window.addEventListener('sessao-expirada', () => {
  if (!ctx.usuario) return;
  definirUsuario(null);
  toast('Sua sessão expirou. Entre de novo.', 'erro');
  location.hash = '#/entrar';
});

api
  .get('/me')
  .then(definirUsuario)
  .catch(() => {})
  .finally(navegar);
