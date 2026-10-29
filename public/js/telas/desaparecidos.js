import { api, carregarDominios } from '../api.js';
import {
  html, raw, $, $$, chip, data, pts, avatar, toast, erroBanco, carimbo, confete, modalForm,
  opcoes, linhaDoTempo, parentesco, PARENTESCOS, SEXO, corScore, hoje,
} from '../ui.js';
import { boneco } from '../boneco.js';
import { editorSinais, listaSinais, marcasDe } from '../sinais.js';
import { seletorLocal } from './comum.js';

const FILTROS = [
  ['', 'Todos'],
  ['ATIVO', 'Ativos'],
  ['EM_ANALISE', 'Em análise'],
  ['LOCALIZADO_VIVO', 'Encontrados vivos'],
  ['IDENTIFICADO_OBITO', 'Identificados'],
];

// ---------------------------------------------------------------------
// Lista ("mural de cartazes")
// ---------------------------------------------------------------------
export async function lista(main, params, ctx) {
  const status = '';

  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo">
        <div><h1 class="titulo">Mural dos desaparecidos</h1>
          <p class="pagina__sub">Cada cartaz é alguém que uma família está procurando.</p></div>
        ${ctx.pode('ATENDENTE') ? html`<a class="btn btn--primario" href="#/desaparecidos/novo">+ Registrar sumiço</a>` : ''}
      </header>
      <div class="filtros">
        <div class="abas" role="tablist">
          ${FILTROS.map(([v, r]) => html`<button role="tab" class="aba ${raw(v === status ? 'ativa' : '')}"
              aria-selected="${v === status}" data-status="${v}">${r}</button>`)}
        </div>
        <input type="search" class="busca" placeholder="Buscar por nome, apelido ou protocolo…" aria-label="Buscar">
      </div>
      <div class="cartazes" id="cartazes"></div>
    </section>`);

  const caixa = $('#cartazes', main);
  let atual = status;
  const carregar = async () => {
    const q = $('.busca', main).value.trim();
    const qs = new URLSearchParams({ ...(atual && { status: atual }), ...(q && { q }) });
    const linhas = await api.get('/desaparecidos?' + qs);
    caixa.innerHTML = linhas.length
      ? String(html`${linhas.map(
          (d) => html`<a class="cartaz" href="#/desaparecidos/${d.id_desaparecido}">
            <span class="cartaz__fita" aria-hidden="true"></span>
            <span class="cartaz__aviso">${d.status === 'LOCALIZADO_VIVO' ? 'ENCONTRADO!' : 'PROCURA-SE'}</span>
            ${avatar(d.nome_desaparecido)}
            <b class="cartaz__nome">${d.nome_desaparecido}</b>
            ${d.apelido ? html`<span class="cartaz__apelido">“${d.apelido}”</span>` : ''}
            <span class="cartaz__dados">${SEXO[d.sexo]} · ${d.idade ?? '?'} anos · ${d.altura_cm ? `${d.altura_cm} cm` : 'altura ?'}</span>
            <span class="cartaz__dados">${d.cidade ? `Visto em ${d.cidade}/${d.uf}` : 'Local não informado'} · ${data(d.data_desaparecimento)}</span>
            <span class="cartaz__rodape">${chip(d.status)}
              ${d.melhor_score ? html`<span class="mini-score score--${corScore(d.melhor_score)}" title="Melhor match">${pts(d.melhor_score)}</span>` : ''}</span>
            <small class="cartaz__protocolo">${d.protocolo}</small>
          </a>`
        )}`)
      : String(html`<p class="vazio">Ninguém por aqui com esse filtro. O que, convenhamos, é uma ótima notícia.</p>`);
  };

  $$('.aba', main).forEach((b) =>
    b.addEventListener('click', () => {
      atual = b.dataset.status;
      $$('.aba', main).forEach((x) => {
        x.classList.toggle('ativa', x === b);
        x.setAttribute('aria-selected', String(x === b));
      });
      carregar();
    })
  );
  let espera;
  $('.busca', main).addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(carregar, 250);
  });
  await carregar();
}

// ---------------------------------------------------------------------
// Cadastro em etapas: pessoa -> familiares -> sinais
// ---------------------------------------------------------------------
export async function novo(main, params, ctx) {
  if (!ctx.pode('ATENDENTE')) {
    main.innerHTML = String(html`<section class="pagina vazio-grande"><h1 class="titulo">Balcão fechado</h1>
      <p>Só atendentes (e a administração) registram desaparecimentos.</p></section>`);
    return;
  }
  const dominios = await carregarDominios();

  main.innerHTML = String(html`
    <section class="pagina">
      <header class="pagina__topo"><div>
        <h1 class="titulo">Registrar sumiço</h1>
        <p class="pagina__sub">Formulário 27-B em três vias. Brincadeira: é uma via só, e digital.</p></div>
      </header>
      <ol class="etapas" aria-label="Etapas">
        <li class="ativa" data-etapa="0">1. A pessoa</li>
        <li data-etapa="1">2. Quem procura</li>
        <li data-etapa="2">3. Sinais particulares</li>
      </ol>
      <form id="form-desap" class="ficha form" novalidate>
        <fieldset data-etapa="0">
          <legend>Quem desapareceu</legend>
          <div class="campos">
            <label class="largo">Nome completo* <input name="nome_desaparecido" required maxlength="120"></label>
            <label>Apelido <input name="apelido" maxlength="60" placeholder="como era conhecido"></label>
            <label>CPF <input name="cpf_desaparecido" inputmode="numeric" maxlength="14"></label>
            <label>Sexo*
              <select name="sexo" required><option value="">—</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>
            <label>Data de nascimento <input name="data_nascimento" type="date" max="${hoje()}"></label>
            <label>…ou idade aproximada <input name="idade_desaparecimento" type="number" min="0" max="120"></label>
            <label>Altura (cm) <input name="altura_cm" type="number" min="30" max="250"></label>
            <label>Peso (kg) <input name="peso_kg" type="number" step="0.1" min="0"></label>
            <label>Cor da pele <input name="cor_pele" maxlength="20"></label>
            <label>Cor do cabelo <input name="cor_cabelo" maxlength="20"></label>
            <label>Cor dos olhos <input name="cor_olhos" maxlength="20"></label>
            <label>Biotipo <select name="tipo_fisico"><option value="">—</option>${opcoes(['MAGRO', 'MEDIO', 'FORTE', 'OBESO'])}</select></label>
            <label class="largo">Roupa que usava <input name="vestimenta"></label>
          </div>
          <h3 class="subtitulo">Quando e onde foi visto pela última vez</h3>
          <div class="campos">
            <label>Data do desaparecimento* <input name="data_desaparecimento" type="date" required max="${hoje()}"></label>
            <label>Boletim de ocorrência <input name="numero_boletim" maxlength="30"></label>
            <div class="largo" id="local-desap"></div>
            <label class="largo">Circunstâncias <textarea name="circunstancias" rows="3"></textarea></label>
          </div>
        </fieldset>

        <fieldset data-etapa="1" hidden>
          <legend>Familiares</legend>
          <p class="dica">O primeiro da lista fica como comunicante (quem registrou). Familiar com o mesmo CPF é reaproveitado.</p>
          <div id="familiares"></div>
          <button type="button" class="btn btn--fantasma" id="add-familiar">+ Outro familiar</button>
        </fieldset>

        <fieldset data-etapa="2" hidden>
          <legend>Sinais particulares</legend>
          <div id="editor-sinais"></div>
        </fieldset>

        <footer class="form__acoes">
          <button type="button" class="btn btn--fantasma" id="voltar" hidden>← Voltar</button>
          <span class="espaco"></span>
          <button type="button" class="btn btn--primario" id="avancar">Avançar →</button>
          <button type="submit" class="btn btn--primario" id="salvar" hidden>Protocolar registro</button>
        </footer>
      </form>
    </section>`);

  const form = $('#form-desap', main);
  const local = seletorLocal($('#local-desap', main), dominios, 'Último local visto');
  const sinais = editorSinais($('#editor-sinais', main), dominios);

  const caixaFam = $('#familiares', main);
  const addFamiliar = () => {
    const bloco = document.createElement('div');
    bloco.className = 'familiar campos';
    bloco.innerHTML = String(html`
      <label class="largo">Nome* <input data-f="nome" required maxlength="120"></label>
      <label>CPF* <input data-f="cpf" required inputmode="numeric" pattern="[0-9.\\-]{11,14}" placeholder="só números"></label>
      <label>Telefone* <input data-f="telefone" required maxlength="15"></label>
      <label>Parentesco* <select data-f="parentesco" required>${opcoes(PARENTESCOS, 'MAE', parentesco)}</select></label>
      <label class="check"><input type="checkbox" data-f="doador_dna"> Aceita doar DNA de referência</label>
      ${caixaFam.children.length ? html`<button type="button" class="btn-icone familiar__remover" aria-label="Remover familiar">✕</button>` : ''}`);
    $('.familiar__remover', bloco)?.addEventListener('click', () => bloco.remove());
    caixaFam.append(bloco);
  };
  addFamiliar();
  $('#add-familiar', main).addEventListener('click', addFamiliar);

  // Navegação entre etapas, validando a etapa atual
  let etapa = 0;
  const mostrar = (n) => {
    etapa = n;
    $$('fieldset[data-etapa]', form).forEach((f) => (f.hidden = Number(f.dataset.etapa) !== n));
    $$('.etapas li', main).forEach((li) => {
      li.classList.toggle('ativa', Number(li.dataset.etapa) === n);
      li.classList.toggle('feita', Number(li.dataset.etapa) < n);
    });
    $('#voltar', main).hidden = n === 0;
    $('#avancar', main).hidden = n === 2;
    $('#salvar', main).hidden = n !== 2;
  };
  const etapaValida = () => {
    const campos = $$(`fieldset[data-etapa="${etapa}"] [required]`, form);
    const invalido = campos.find((c) => !c.checkValidity());
    if (invalido) {
      invalido.reportValidity();
      return false;
    }
    if (etapa === 0 && !form.data_nascimento.value && !form.idade_desaparecimento.value) {
      toast('Informe a data de nascimento ou a idade. O banco não aceita "uns 30 e poucos".', 'erro');
      form.data_nascimento.focus();
      return false;
    }
    return true;
  };
  $('#avancar', main).addEventListener('click', () => etapaValida() && mostrar(etapa + 1));
  $('#voltar', main).addEventListener('click', () => mostrar(etapa - 1));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    dados.cpf_desaparecido = (dados.cpf_desaparecido || '').replace(/\D/g, '');
    dados.id_local = await local.valor();
    if (dados.id_local === undefined) return;
    dados.familiares = $$('.familiar', caixaFam).map((b) => ({
      nome: $('[data-f=nome]', b).value,
      cpf: $('[data-f=cpf]', b).value.replace(/\D/g, ''),
      telefone: $('[data-f=telefone]', b).value,
      parentesco: $('[data-f=parentesco]', b).value,
      doador_dna: $('[data-f=doador_dna]', b).checked,
    }));
    dados.sinais = sinais();

    $('#salvar', main).disabled = true;
    try {
      const r = await api.post('/desaparecidos', dados);
      carimbo('PROTOCOLADO');
      toast(`Protocolo ${r.protocolo}. Guarde com carinho.`, 'sucesso', 6000);
      if (r.novas_correspondencias > 0) {
        setTimeout(() => toast(`O cruzamento já achou ${r.novas_correspondencias} possível(is) match(es)!`, 'info', 6000), 900);
      }
      setTimeout(() => (location.hash = `#/desaparecidos/${r.id_desaparecido}`), 1300);
    } catch (e) {
      erroBanco(e);
      $('#salvar', main).disabled = false;
    }
  });
}

// ---------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------
export async function ficha(main, [id], ctx) {
  const d = await api.get(`/desaparecidos/${id}`);
  const ativo = ['ATIVO', 'EM_ANALISE'].includes(d.status);
  const idade = d.data_nascimento
    ? Math.floor((Date.now() - new Date(d.data_nascimento)) / 31557600000)
    : d.idade_desaparecimento;

  main.innerHTML = String(html`
    <section class="pagina">
      <a class="voltar" href="#/desaparecidos">← Mural</a>
      <header class="pagina__topo">
        <div class="pagina__identidade">${avatar(d.nome_desaparecido)}
          <div><h1 class="titulo">${d.nome_desaparecido}</h1>
          <p class="pagina__sub">${d.apelido ? `“${d.apelido}” · ` : ''}${d.protocolo} · ${chip(d.status)}</p></div>
        </div>
        ${ativo && ctx.pode('ATENDENTE', 'INVESTIGADOR')
          ? html`<div class="pagina__acoes">
              <button class="btn btn--verde" id="vivo">Encontrado vivo! 🎉</button>
              <button class="btn btn--fantasma" id="arquivar">Arquivar caso</button></div>`
          : ''}
      </header>

      <div class="duas-colunas">
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Dados da pessoa</h2>
            <dl class="dados">
              <dt>Sexo</dt><dd>${SEXO[d.sexo]}</dd>
              <dt>Nascimento</dt><dd>${d.data_nascimento ? `${data(d.data_nascimento)} (${idade} anos)` : `idade informada: ${d.idade_desaparecimento}`}</dd>
              <dt>Altura / peso</dt><dd>${d.altura_cm ? `${d.altura_cm} cm` : '—'} / ${d.peso_kg ? `${d.peso_kg} kg` : '—'}</dd>
              <dt>Pele / cabelo / olhos</dt><dd>${[d.cor_pele, d.cor_cabelo, d.cor_olhos].map((x) => x || '—').join(' / ')}</dd>
              <dt>Biotipo</dt><dd>${d.tipo_fisico || '—'}</dd>
              <dt>Vestimenta</dt><dd>${d.vestimenta || '—'}</dd>
              <dt>Desapareceu em</dt><dd>${data(d.data_desaparecimento)}</dd>
              <dt>Último local</dt><dd>${d.local_nome ? `${d.local_nome} · ${d.cidade}/${d.uf}` : '—'}</dd>
              <dt>BO</dt><dd>${d.numero_boletim || '—'}</dd>
              <dt>Circunstâncias</dt><dd>${d.circunstancias || '—'}</dd>
              <dt>Registrado por</dt><dd>${d.cadastrado_por || '—'}</dd>
            </dl>
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Familiares</h2>
            <ul class="familiares">
              ${d.familiares.map(
                (f) => html`<li>${avatar(f.nome)}<span><b>${f.nome}</b> · ${parentesco(f.parentesco)}
                  <small>${f.telefone}${f.comunicante ? ' · comunicante' : ''}${f.doador_dna ? ' · doador de DNA 🧬' : ''}</small></span></li>`
              )}
            </ul>
          </section>
        </div>
        <div class="coluna">
          <section class="ficha">
            <h2 class="subtitulo">Sinais particulares</h2>
            <div class="sinais-com-boneco">
              ${boneco({ marcas: marcasDe(d.sinais) })}
              ${listaSinais(d.sinais)}
            </div>
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Matches com corpos</h2>
            ${d.correspondencias.length
              ? html`<ul class="matches-mini">${d.correspondencias.map(
                  (c) => html`<li><a href="#/casos/${c.id_correspondencia}">
                    <span class="mini-score score--${corScore(c.score_total)}">${pts(c.score_total)}</span>
                    <span>${c.codigo_iml}</span>${chip(c.status)}</a></li>`
                )}</ul>`
              : html`<p class="vazio">Nenhum corpo compatível até agora. Sem notícia, por enquanto, é boa notícia.</p>`}
          </section>
          <section class="ficha">
            <h2 class="subtitulo">Linha do tempo</h2>
            ${linhaDoTempo(d.historico)}
          </section>
        </div>
      </div>
    </section>`);

  const mudar = async (status, titulo, rotuloBotao) => {
    const r = await modalForm({
      titulo,
      confirmar: rotuloBotao,
      corpo: html`<label>Observação* <textarea name="observacao" rows="3" required
        placeholder="Ex.: voltou para casa por conta própria"></textarea></label>`,
    });
    if (!r) return;
    try {
      await api.patch(`/desaparecidos/${id}/status`, { status, observacao: r.observacao });
      if (status === 'LOCALIZADO_VIVO') {
        confete();
        carimbo('ESTAVA VIVO!', 'verde');
        toast('Melhor desfecho possível. As sugestões abertas foram descartadas.', 'sucesso', 6000);
      } else {
        carimbo('ARQUIVADO');
      }
      setTimeout(ctx.recarregar, 1200);
    } catch (e) {
      erroBanco(e);
    }
  };
  $('#vivo', main)?.addEventListener('click', () => mudar('LOCALIZADO_VIVO', 'Pessoa localizada com vida', 'Marcar como encontrada'));
  $('#arquivar', main)?.addEventListener('click', () => mudar('ENCERRADO', 'Arquivar o caso', 'Arquivar'));
}
