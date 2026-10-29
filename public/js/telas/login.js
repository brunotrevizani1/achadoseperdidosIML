import { api } from '../api.js';
import { html, $, toast } from '../ui.js';

export async function render(main, params, ctx) {
  if (ctx.usuario) {
    location.hash = '#/admin';
    return;
  }
  main.innerHTML = String(html`
    <section class="login">
      <div class="login__intro">
        <p class="login__sobretitulo">Instituto Médico Legal · Área restrita</p>
        <h1 class="login__titulo">Área do<br><span>IML</span></h1>
        <p class="login__lema">Cadastro de objetos e corpos, e avaliação das manifestações do público.</p>
        <form class="cracha" id="form-login" autocomplete="on">
          <div class="cracha__furo" aria-hidden="true"></div>
          <h2 class="cracha__titulo">Entrar</h2>
          <label>E-mail funcional <input name="email" type="email" required autocomplete="username"
                 placeholder="voce@iml.demo"></label>
          <label>Senha <input name="senha" type="password" required autocomplete="current-password"></label>
          <button class="btn btn--primario btn--largo" type="submit">Entrar</button>
          <p class="cracha__aviso">Demonstração: <b>admin@iml.demo</b> / <b>iml123</b></p>
        </form>
      </div>
    </section>`);

  const form = $('#form-login', main);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const botao = $('button[type=submit]', form);
    botao.disabled = true;
    try {
      const usuario = await api.post('/login', { email: form.email.value, senha: form.senha.value });
      toast(`Bom plantão, ${usuario.nome.split(' ')[0]}!`, 'sucesso');
      ctx.entrou(usuario);
    } catch (e) {
      toast(e.message, 'erro');
      botao.disabled = false;
    }
  });
}
