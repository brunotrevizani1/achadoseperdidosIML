// Painel de acesso em 3D: abre ao clicar na porta ou no teclado de senha da recepção.
// Resolve com o usuário logado, ou null se a pessoa fechar o painel.
import { api } from '../api.js';
import { html, $ } from '../ui.js';

export function abrirAcesso() {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'acesso';
    dlg.innerHTML = String(html`
      <div class="acesso__cena">
        <form class="acesso__painel" autocomplete="on" novalidate>
          <i class="acesso__parafuso acesso__parafuso--a"></i><i class="acesso__parafuso acesso__parafuso--b"></i>
          <i class="acesso__parafuso acesso__parafuso--c"></i><i class="acesso__parafuso acesso__parafuso--d"></i>
          <header class="acesso__topo">
            <span class="acesso__led" id="acesso-led"></span>
            <b>ACESSO RESTRITO</b>
            <button type="button" class="acesso__fechar" data-fechar aria-label="Fechar">✕</button>
          </header>
          <div class="acesso__visor" id="acesso-visor" role="status" aria-live="polite">DIGITE SUAS CREDENCIAIS</div>
          <label>E-MAIL FUNCIONAL
            <input name="email" type="email" required autocomplete="username" placeholder="voce@iml.demo"></label>
          <label>SENHA
            <input name="senha" type="password" required autocomplete="current-password" placeholder="senha"></label>
          <button class="acesso__botao" type="submit">ENTRAR</button>
          <p class="acesso__dica">Demonstração: admin@iml.demo / iml123</p>
        </form>
      </div>`);
    document.body.append(dlg);
    const painel = $('.acesso__painel', dlg);
    const visor = $('#acesso-visor', dlg);
    const led = $('#acesso-led', dlg);
    let resultado = null;
    let ocupado = false;

    // o painel acompanha o mouse, como se estivesse na parede
    dlg.addEventListener('pointermove', (e) => {
      const r = painel.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      painel.style.setProperty('--ry', `${(dx * 14).toFixed(2)}deg`);
      painel.style.setProperty('--rx', `${(-dy * 12).toFixed(2)}deg`);
    });
    $('[data-fechar]', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(resultado);
    });

    painel.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (ocupado) return;
      if (!painel.checkValidity()) {
        visor.textContent = 'PREENCHA E-MAIL E SENHA';
        return;
      }
      ocupado = true;
      visor.textContent = 'VERIFICANDO…';
      try {
        const usuario = await api.post('/login', { email: painel.email.value, senha: painel.senha.value });
        resultado = usuario;
        led.classList.add('acesso__led--ok');
        visor.textContent = `ACESSO LIBERADO · ${usuario.nome.split(' ')[0].toUpperCase()}`;
        setTimeout(() => dlg.close(), 300);
      } catch (e) {
        ocupado = false;
        led.classList.add('acesso__led--erro');
        visor.textContent = 'ACESSO NEGADO';
        painel.classList.remove('acesso__painel--treme');
        void painel.offsetWidth; // reinicia a animação
        painel.classList.add('acesso__painel--treme');
        setTimeout(() => led.classList.remove('acesso__led--erro'), 1200);
      }
    });
    dlg.showModal();
    painel.email.focus();
  });
}
