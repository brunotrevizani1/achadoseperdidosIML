import { api } from '../api.js';
import { html, $, $$, toast, avatar } from '../ui.js';

const DESCRICAO_PERFIL = {
  ATENDENTE: 'Atende as famílias e registra desaparecimentos',
  PERITO: 'Cadastra corpos, faz exames e confirma identidades',
  INVESTIGADOR: 'Analisa os matches e registra confrontos',
  ADMIN: 'Manda em tudo (inclusive no café)',
};

export async function render(main, aoEntrar) {
  let demo = [];
  try {
    demo = await api.get('/usuarios-demo');
  } catch (e) {
    toast(e.message, 'erro', 8000);
  }

  main.innerHTML = String(html`
    <section class="login">
      <div class="login__intro">
        <p class="login__sobretitulo">Instituto Médico Legal · Setor de Identificação</p>
        <h1 class="login__titulo">Achados &amp; Perdidos<br><span>do IML</span></h1>
        <p class="login__lema">Cruzamos quem chegou aqui com quem alguém está procurando.
           Com método pericial, pontuação de 0 a 100 e muito café.</p>
        <form class="cracha" id="form-login" autocomplete="on">
          <div class="cracha__furo" aria-hidden="true"></div>
          <h2 class="cracha__titulo">Bate-ponto</h2>
          <p class="cracha__aviso">Ninguém entra sem identificação. (A ironia não foi intencional.)</p>
          <label>E-mail funcional <input name="email" type="email" required autocomplete="username"
                 placeholder="voce@iml.demo"></label>
          <label>Senha <input name="senha" type="password" required autocomplete="current-password"></label>
          <button class="btn btn--primario btn--largo" type="submit">Passar o crachá</button>
        </form>
      </div>
      <div class="login__demo">
        <h2 class="subtitulo">Crachás de demonstração <small>(senha: iml123)</small></h2>
        <div class="crachas-demo">
          ${demo.map(
            (u) => html`<button type="button" class="cracha-demo" data-email="${u.email}">
              ${avatar(u.nome)}
              <span><b>${u.nome}</b><small>${u.perfil} · ${u.matricula || ''}</small>
              <em>${DESCRICAO_PERFIL[u.perfil] || ''}</em></span>
            </button>`
          )}
        </div>
      </div>
    </section>`);

  const form = $('#form-login', main);
  $$('.cracha-demo', main).forEach((b) =>
    b.addEventListener('click', () => {
      form.email.value = b.dataset.email;
      form.senha.value = 'iml123';
      form.requestSubmit();
    })
  );

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const botao = $('button[type=submit]', form);
    botao.disabled = true;
    try {
      const usuario = await api.post('/login', { email: form.email.value, senha: form.senha.value });
      form.classList.add('cracha--aprovado');
      await new Promise((r) => setTimeout(r, 650));
      toast(`Bom plantão, ${usuario.nome.split(' ')[0]}!`, 'sucesso');
      aoEntrar(usuario);
    } catch (e) {
      form.classList.remove('treme');
      void form.offsetWidth;
      form.classList.add('treme');
      toast(e.message, 'erro');
      botao.disabled = false;
    }
  });
}
