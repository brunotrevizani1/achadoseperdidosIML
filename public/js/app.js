// Roteador da SPA e sessão do usuário
import { api } from './api.js';
import { html, $, $$, toast } from './ui.js';
import * as login from './telas/login.js';
import * as barraca from './telas/barraca.js';
import * as painel from './telas/painel.js';
import * as estoque from './telas/estoque.js';
import * as objetos from './telas/objetos.js';
import * as corpos from './telas/corpos.js';
import * as manifestacoes from './telas/manifestacoes.js';

// [regex, tela, item do menu, exige login]
const ROTAS = [
  [/^\/?$/, barraca.render, 'mural', false],
  [/^\/entrar$/, login.render, 'entrar', false],
  [/^\/admin\/?$/, painel.render, 'painel', true],
  [/^\/admin\/(estoque|objetos|corpos)$/, estoque.lista, 'estoque', true],
  [/^\/admin\/objetos\/novo$/, objetos.novo, 'estoque', true],
  [/^\/admin\/objetos\/(\d+)$/, objetos.ficha, 'estoque', true],
  [/^\/admin\/corpos\/novo$/, corpos.novo, 'estoque', true],
  [/^\/admin\/corpos\/(\d+)$/, corpos.ficha, 'estoque', true],
  [/^\/admin\/manifestacoes$/, manifestacoes.lista, 'manifestacoes', true],
];

const ctx = {
  usuario: null,
  recarregar: () => navegar(),
  entrou: (usuario) => {
    definirUsuario(usuario);
    location.hash = '#/admin';
  },
};

const main = $('#conteudo');

async function navegar() {
  const caminho = location.hash.replace(/^#/, '') || '/';
  const rota = ROTAS.find(([re]) => re.test(caminho));
  $$('[data-rota]').forEach((a) => a.classList.toggle('ativo', rota && a.dataset.rota === rota[2]));
  fecharMenu();
  document.body.classList.toggle('admin', !!(rota && rota[3]));
  document.body.classList.toggle('barraca-tela', !!rota && rota[1] === barraca.render);

  if (!rota) {
    main.innerHTML = String(html`<section class="pagina vazio-grande">
      <h1 class="titulo">404</h1><p>Página não encontrada.</p>
      <a class="btn" href="#/">Voltar ao mural</a></section>`);
    return;
  }
  if (rota[3] && !ctx.usuario) {
    location.hash = '#/entrar';
    return;
  }
  const params = caminho.match(rota[0]).slice(1);
  main.innerHTML = '<div class="carregando" role="status">Carregando…</div>';
  try {
    await rota[1](main, params, ctx);
  } catch (e) {
    if (e.status === 401) return;
    main.innerHTML = String(html`<section class="pagina vazio-grande">
      <h1 class="titulo">Ops.</h1><p>${e.message}</p><a class="btn" href="#/">Voltar ao mural</a></section>`);
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  atualizarPendentes();
}

function definirUsuario(usuario) {
  ctx.usuario = usuario;
  $$('[data-admin]').forEach((a) => (a.hidden = !usuario));
  $('#entrar').hidden = !!usuario;
  $('#sair').hidden = !usuario;
  $('#cracha').hidden = !usuario;
  if (usuario) $('#cracha').innerHTML = String(html`<b>${usuario.nome}</b><small>IML</small>`);
  atualizarPendentes();
}

// Contador de manifestações na fila, ao lado do item do menu
async function atualizarPendentes() {
  const el = $('#pendentes');
  if (!ctx.usuario) return (el.textContent = '');
  try {
    const p = await api.get('/admin/painel');
    const n = (p.manifestacoes.RECEBIDA || 0) + (p.manifestacoes.EM_ANALISE || 0);
    el.textContent = n || '';
  } catch {}
}

function fecharMenu() {
  $('.topo').classList.remove('menu-aberto');
  $('.topo__menu').setAttribute('aria-expanded', 'false');
}

$('.topo__menu').addEventListener('click', () => {
  const aberto = $('.topo').classList.toggle('menu-aberto');
  $('.topo__menu').setAttribute('aria-expanded', String(aberto));
});

$('#sair').addEventListener('click', async () => {
  await api.post('/logout').catch(() => {});
  definirUsuario(null);
  toast('Sessão encerrada.');
  location.hash = '#/';
  navegar();
});

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
