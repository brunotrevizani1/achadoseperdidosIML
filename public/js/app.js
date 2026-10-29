// Roteador da SPA e sessão do usuário
import { api } from './api.js';
import { html, $, $$, toast } from './ui.js';
import * as login from './telas/login.js';
import * as painel from './telas/painel.js';
import * as desaparecidos from './telas/desaparecidos.js';
import * as corpos from './telas/corpos.js';
import * as match from './telas/match.js';
import * as caso from './telas/caso.js';

const ROTAS = [
  [/^\/?$/, painel.render, 'painel'],
  [/^\/desaparecidos$/, desaparecidos.lista, 'desaparecidos'],
  [/^\/desaparecidos\/novo$/, desaparecidos.novo, 'desaparecidos'],
  [/^\/desaparecidos\/(\d+)$/, desaparecidos.ficha, 'desaparecidos'],
  [/^\/corpos$/, corpos.lista, 'corpos'],
  [/^\/corpos\/novo$/, corpos.novo, 'corpos'],
  [/^\/corpos\/(\d+)$/, corpos.ficha, 'corpos'],
  [/^\/match$/, match.render, 'match'],
  [/^\/casos\/(\d+)$/, caso.render, 'match'],
];

const ctx = {
  usuario: null,
  // ADMIN pode tudo, como no backend
  pode: (...perfis) => ctx.usuario && (ctx.usuario.perfil === 'ADMIN' || perfis.includes(ctx.usuario.perfil)),
  recarregar: () => navegar(),
};

const main = $('#conteudo');

async function navegar() {
  if (!ctx.usuario) return mostrarLogin();
  const caminho = location.hash.replace(/^#/, '') || '/';
  const rota = ROTAS.find(([re]) => re.test(caminho));
  $$('.nav a').forEach((a) => a.classList.toggle('ativo', rota && a.dataset.rota === rota[2]));
  fecharMenu();

  if (!rota) {
    main.innerHTML = String(html`<section class="pagina vazio-grande">
      <h1 class="titulo">404</h1><p>Página não identificada. Já foi encaminhada para a perícia.</p>
      <a class="btn" href="#/">Voltar ao painel</a></section>`);
    return;
  }
  const params = caminho.match(rota[0]).slice(1);
  main.innerHTML = '<div class="carregando" role="status">Abrindo as gavetas…</div>';
  try {
    await rota[1](main, params, ctx);
  } catch (e) {
    if (e.status === 401) return;
    main.innerHTML = String(html`<section class="pagina vazio-grande">
      <h1 class="titulo">Ops.</h1><p>${e.message}</p><a class="btn" href="#/">Voltar ao painel</a></section>`);
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function mostrarLogin() {
  $('.topo').hidden = true;
  $('.rodape').hidden = true;
  login.render(main, async (usuario) => {
    entrar(usuario);
    navegar();
  });
}

function entrar(usuario) {
  ctx.usuario = usuario;
  $('.topo').hidden = false;
  $('.rodape').hidden = false;
  $('#cracha').innerHTML = String(html`<b>${usuario.nome}</b><small>${usuario.perfil}</small>`);
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
  ctx.usuario = null;
  toast('Ponto batido. Bom descanso!');
  location.hash = '#/';
  mostrarLogin();
});

// Tema: claro (plantão diurno) / escuro (plantão noturno)
function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.theme = tema;
  else delete document.documentElement.dataset.theme;
}
try {
  aplicarTema(localStorage.getItem('iml-tema'));
} catch {}
$('#tema').addEventListener('click', () => {
  const escuroAgora =
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const novo = escuroAgora ? 'light' : 'dark';
  aplicarTema(novo);
  try {
    localStorage.setItem('iml-tema', novo);
  } catch {}
  toast(novo === 'dark' ? 'Plantão noturno ativado. Cuidado com os sustos.' : 'Plantão diurno. Bom dia, equipe!');
});

window.addEventListener('hashchange', navegar);
window.addEventListener('sessao-expirada', () => {
  if (!ctx.usuario) return;
  ctx.usuario = null;
  toast('Seu crachá expirou. Passe de novo.', 'erro');
  mostrarLogin();
});

api
  .get('/me')
  .then((u) => entrar(u))
  .catch(() => {})
  .finally(navegar);
