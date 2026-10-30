// A recepção de achados e perdidos do IML em 3D (three.js): balcão e estantes de inox
// para os objetos, e a câmara fria com as gavetas dos corpos não identificados
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { criarModelo, criarGaveta, fundir, ALCANCE_GAVETA, ESCALA_GAVETA } from './modelos.js';
import * as tex from './texturas.js';
import { criarPorta, ABERTURA_PORTA } from './porta.js';
import { criarPlanta, criarBanco, criarTapete } from './decoracao.js';
import { criarLampadas, ajustarLuzes } from './lampadas.js';

const POR_PRATELEIRA = 6;
const ESPACO = 1.05; // distância entre os itens
const ALTURA_BALCAO = 1.0;
const ENTRE_PRATELEIRAS = 0.95;
const LARGURA_ESQ = 6.4; // balcão e estantes dos objetos (lado esquerdo)
const CENTRO_ESQ = -1.5;
const Z_PAREDE = -1.3;
const X_PORTA = -6.5; // porta de acesso restrito, na ponta esquerda da parede
// Câmara fria dos corpos (lado direito): gavetas em grade, de baixo para cima
const X_BORDA_CAMARA = 1.95; // a câmara começa logo depois do balcão e cresce para a direita
const PASSO_X = 0.95;
const PASSO_Y = 0.85;
const BASE_CAMARA = 0.12;
const Z_CAMARA = 0.25; // frente da câmara
const ALCANCE = ALCANCE_GAVETA * ESCALA_GAVETA;
const ZERO2 = new THREE.Vector2();
const TAMANHO = {
  CELULAR: 0.85, DOCUMENTO: 0.8, ALIANCA: 0.6, MOCHILA: 0.95, CARTEIRA: 0.82, JOIA: 0.85, ROUPA: 0.9, CHAVES: 0.78, OUTRO: 0.9,
  OCULOS: 0.7, RELOGIO: 0.7, CALCADO: 0.95, BONE: 0.85, FONE: 0.85, GUARDA_CHUVA: 1.0, BOLSA: 0.9, NOTEBOOK: 1.0,
};

const easeOutBounce = (t) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const chaveDe = (i) => `${i.tipo}-${i.id}`;
// o que o mouse devolve quando está sobre a porta ou o teclado de senha
const PORTA = { porta: true, item: { tipo: 'porta', titulo: 'Área restrita · clique para entrar' } };
const LAMPADA = { lampada: true, item: { tipo: 'lampada', titulo: '' } };

function liberar(objeto) {
  objeto.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    [].concat(o.material).forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  });
}

export class Barraca3D {
  constructor(container, { aoClicar, aoPassar }) {
    this.container = container;
    this.aoClicar = aoClicar;
    this.aoPassar = aoPassar;
    this.entradas = new Map();
    this.assinatura = '';
    this.estrutura = null;
    this.ponteiro = new THREE.Vector2(9, 9);
    this.parallax = new THREE.Vector2();
    this.relogio = new THREE.Clock();
    this.zoomT = 0; // 0 = câmera normal, 1 = colada na porta
    this.portaAberta = 0;
    this._p = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this.forcar = true; // desenha o próximo quadro mesmo sem nada se mexendo
    this.sombraAnterior = true;
    this.pausado = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false; // as sombras só são refeitas quando algo se move
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMappingExposure = 0.9;
    this.razaoMaxima = Math.min(window.devicePixelRatio, 1.25);
    this.razao = this.razaoMaxima;
    this.mediaQuadro = 16;
    container.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#d9e2e5');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.montarAmbiente();
    this.montarEstrutura(2, 0);
    this.redimensionar();

    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(container);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', (e) => {
      this.ultimoMove = e; // um teste de mouse por quadro, no máximo
      if (this.movePendente) return;
      this.movePendente = true;
      requestAnimationFrame(() => {
        this.movePendente = false;
        this.aoMover(this.ultimoMove);
      });
    });
    canvas.addEventListener('pointerleave', () => this.sairDoPonteiro());
    canvas.addEventListener('pointerdown', (e) => (this.inicio = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => this.aoSoltar(e));

    // compila os shaders já, enquanto a tela ainda está esmaecida (compileAsync não é confiável em todas as placas)
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {
      /* compila no primeiro quadro */
    }
    this.pronta = Promise.resolve();
    this.renderer.setAnimationLoop(() => this.quadro());
  }

  // ---------------------------------------------------------------- cenário
  // Sala do IML: piso de porcelanato, parede azulejada com faixa pintada, placa e relógio
  montarAmbiente() {
    const luz = new THREE.DirectionalLight('#f5f9ff', 2.4);
    luz.position.set(5, 9, 8);
    luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    Object.assign(luz.shadow.camera, { left: -9, right: 9, top: 8, bottom: -3, near: 1, far: 32 });
    luz.shadow.bias = -0.0004;
    luz.shadow.normalBias = 0.03;
    this.luzDir = luz;
    this.luzHemi = new THREE.HemisphereLight('#e8f4ff', '#9aa5a8', 0.8);
    this.scene.add(luz, this.luzHemi);

    const piso = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 60),
      new THREE.MeshStandardMaterial({ map: tex.pisoPorcelanato({ x: 30, y: 20 }), roughness: 0.18, metalness: 0.05 })
    );
    piso.rotation.x = -Math.PI / 2;
    piso.position.z = 8;
    piso.receiveShadow = true;
    this.scene.add(piso);

    const ALTURA_AZULEJO = 2.4;
    const azulejo = new THREE.Mesh(
      new THREE.PlaneGeometry(80, ALTURA_AZULEJO),
      new THREE.MeshStandardMaterial({ map: tex.azulejoParede({ x: 80 / 1.2, y: ALTURA_AZULEJO / 1.2 }), roughness: 0.25 })
    );
    azulejo.position.set(0, ALTURA_AZULEJO / 2, Z_PAREDE);
    const pintada = new THREE.Mesh(new THREE.PlaneGeometry(80, 14), new THREE.MeshStandardMaterial({ color: '#cfe0df', roughness: 0.9 }));
    pintada.position.set(0, ALTURA_AZULEJO + 7, Z_PAREDE);
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(80, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: '#0f5e66', roughness: 0.5 }));
    faixa.position.set(0, ALTURA_AZULEJO, Z_PAREDE + 0.02);
    const rodape = new THREE.Mesh(new THREE.BoxGeometry(80, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: '#59666b', roughness: 0.6 }));
    rodape.position.set(0, 0.07, Z_PAREDE + 0.015);
    [azulejo, pintada].forEach((p) => (p.receiveShadow = true));
    this.scene.add(azulejo, pintada, faixa, rodape);

    const relogio = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshStandardMaterial({ map: tex.relogio(), roughness: 0.4 }));
    relogio.position.set(1.35, 3.85, Z_PAREDE + 0.02);
    this.scene.add(relogio);

    // Faixa amarela de segurança no piso, na frente do balcão
    const faixaPiso = new THREE.Mesh(new THREE.PlaneGeometry(LARGURA_ESQ + 0.6, 0.1), new THREE.MeshStandardMaterial({ color: '#e8c230', roughness: 0.6 }));
    faixaPiso.rotation.x = -Math.PI / 2;
    faixaPiso.position.set(CENTRO_ESQ, 0.004, 1.9);
    this.scene.add(faixaPiso);

    this.montarPorta();
    this.lampadas = criarLampadas(this.scene, {
      posicoes: [[-3.6, 2.6, 2.4], [0.2, 2.6, 2.4], [3.9, 2.6, 2.4]],
      y: 5.0,
      aoMudar: (t) => this.aplicarLuz(t),
    });

    // móveis de espera: planta no canto, banco e tapete diante do balcão
    const por = (o, x, y, z, giro = 0) => {
      o.position.set(x, y, z);
      o.rotation.y = giro;
      this.scene.add(o);
    };
    por(criarPlanta(1.2), -5.3, 0, 2.7);
    por(criarBanco(1.9), -2.2, 0, 4.2, Math.PI);
    por(criarTapete(3.4, 1.6, '#7a3b3b'), -2.2, 0.004, 4.1);
  }

  // Brilho geral conforme as luminárias: apagadas, só sobra uma luz fraca
  aplicarLuz(t) {
    ajustarLuzes(this.scene, { dir: this.luzDir, hemi: this.luzHemi }, t);
    this.forcar = true;
  }

  // Porta de aço com teclado de senha ao lado: leva à sala do administrador
  montarPorta() {
    const p = criarPorta({ rotulo: 'ÁREA RESTRITA', teclado: true });
    p.grupo.position.set(X_PORTA, 0, Z_PAREDE);
    this.scene.add(p.grupo);
    this.folhaPorta = p.folha;
    this.alvosPorta = p.alvos;
    this.led = p.led;
    // onde a câmera fica ao "entrar" pela porta
    this.focoPorta = new THREE.Vector3(X_PORTA + 0.05, 1.25, Z_PAREDE);
    this.camPorta = new THREE.Vector3(X_PORTA + 0.45, 1.45, 1.9);
  }

  animarPorta(para, duracao = 900) {
    return new Promise((resolve) => {
      this.animPorta = { de: this.portaAberta, para, inicio: performance.now(), duracao, resolve };
    });
  }

  abrirPorta(duracao = 900) {
    return this.animarPorta(1, duracao);
  }

  // Zoom até a porta (entrar) ou de volta à vista geral (sair)
  zoomPorta(entrar = true, duracao = 1300) {
    return new Promise((resolve) => {
      this.zoomAnim = { de: this.zoomT, para: entrar ? 1 : 0, inicio: performance.now(), duracao, resolve };
    });
  }

  // Chegada pela porta de dentro: a câmera começa colada nela e se afasta, enquanto a porta se fecha
  introSaida() {
    this.zoomT = 1;
    this.portaAberta = 1;
    this.folhaPorta.rotation.y = -ABERTURA_PORTA;
    this.forcar = true;
    setTimeout(() => this.animarPorta(0, 900), 450);
    return this.zoomPorta(false, 1500);
  }

  // Dá um respiro à GPU quando algo cobre a cena (janelas e painéis)
  pausar(p) {
    this.pausado = p;
    if (!p) {
      this.forcar = true;
      this.relogio.getDelta();
    }
  }

  // Balcão, estantes e câmara fria. Cresce com o número de fileiras e de corpos
  montarEstrutura(linhas, corpos) {
    if (this.estrutura) {
      this.scene.remove(this.estrutura);
      liberar(this.estrutura);
    }
    this.linhas = linhas;
    this.corpos = corpos;
    this.colunas = corpos > 9 ? 4 : 3; // com muitos corpos a câmara fica mais larga em vez de mais alta
    this.linhasCamara = Math.max(2, Math.ceil(corpos / this.colunas));
    this.xCamara = X_BORDA_CAMARA + (this.colunas * PASSO_X + 0.2) / 2;
    this.assinatura = `${linhas}|${corpos}`;

    const g = new THREE.Group();
    const topoPrateleira = ALTURA_BALCAO + (linhas - 1) * ENTRE_PRATELEIRAS;
    const altoEstante = topoPrateleira + 1.15;
    const altoCamara = BASE_CAMARA + this.linhasCamara * PASSO_Y + 0.08;
    this.altura = Math.max(altoEstante + 1.25, altoCamara + 1.5, 4.2);

    const inox = new THREE.MeshStandardMaterial({ color: '#c3ccd1', metalness: 0.9, roughness: 0.3 });
    const inoxEscuro = new THREE.MeshStandardMaterial({ color: '#8f9ba1', metalness: 0.85, roughness: 0.4 });
    const branco = new THREE.MeshStandardMaterial({ color: '#e9eff1', roughness: 0.45 });
    const parte = (geo, m, x, y, z) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      g.add(o);
      return o;
    };
    const placa = (largura, altura, textura, x, y, z) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshStandardMaterial({ map: textura, roughness: 0.6 }));
      p.position.set(x, y, z);
      g.add(p);
    };

    // Balcão de atendimento: frente laminada branca e tampo de inox
    parte(new RoundedBoxGeometry(LARGURA_ESQ + 0.3, ALTURA_BALCAO, 0.9, 3, 0.02), branco, CENTRO_ESQ, ALTURA_BALCAO / 2, 0.85);
    parte(new THREE.BoxGeometry(LARGURA_ESQ + 0.5, 0.06, 1.05), inox, CENTRO_ESQ, ALTURA_BALCAO + 0.03, 0.85);
    placa(4.2, 0.66, tex.letreiro('ACHADOS & PERDIDOS'), CENTRO_ESQ, 0.5, 1.305);

    // Estante de inox atrás do balcão
    for (let r = 1; r < linhas; r++) {
      parte(new THREE.BoxGeometry(LARGURA_ESQ, 0.05, 0.7), inox, CENTRO_ESQ, ALTURA_BALCAO + r * ENTRE_PRATELEIRAS - 0.025, -0.85);
    }
    parte(new THREE.BoxGeometry(LARGURA_ESQ, 0.9, 0.7), inoxEscuro, CENTRO_ESQ, 0.45, -0.85); // armário sob a estante
    [-3.2, -1.6, 0, 1.6, 3.2].forEach((dx) => {
      parte(new THREE.BoxGeometry(0.05, altoEstante, 0.05), inox, CENTRO_ESQ + dx, altoEstante / 2, -1.2);
    });
    parte(new THREE.BoxGeometry(LARGURA_ESQ + 0.05, 0.05, 0.1), inox, CENTRO_ESQ, altoEstante, -1.2);

    placa(3.6, 0.9, tex.placaIML(), CENTRO_ESQ, altoEstante + 0.7, Z_PAREDE + 0.015);

    // Câmara fria: um corpo de inox com uma porta por gaveta; as ocupadas ficam abertas
    const larguraCamara = this.colunas * PASSO_X + 0.2;
    parte(new THREE.BoxGeometry(larguraCamara, altoCamara, 1.0), inoxEscuro, this.xCamara, altoCamara / 2, Z_CAMARA - 0.5);
    const abertura = new THREE.MeshStandardMaterial({ color: '#0b0f11', roughness: 0.95 });
    for (let i = 0; i < this.linhasCamara * this.colunas; i++) {
      const x = this.xCamara + ((i % this.colunas) - (this.colunas - 1) / 2) * PASSO_X;
      const y = BASE_CAMARA + Math.floor(i / this.colunas) * PASSO_Y + 0.42;
      const porta = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 0.72),
        i < corpos ? abertura : new THREE.MeshStandardMaterial({ map: tex.portaInox(`G-${String(i + 1).padStart(2, '0')}`), metalness: 0.5, roughness: 0.4 })
      );
      porta.position.set(x, y, Z_CAMARA + 0.003);
      porta.receiveShadow = true;
      g.add(porta);
    }
    placa(2.8, 0.44, tex.letreiro('NÃO IDENTIFICADOS', { fundo: '#7a1f2b', borda: '#e0a3ac' }), this.xCamara, Math.max(altoCamara + 0.55, 2.9), Z_PAREDE + 0.015);

    fundir(g); // balcão, estantes e câmara: tudo o que usa o mesmo material vira uma malha só
    this.estrutura = g;
    this.scene.add(g);
    this.forcar = true;
    this.sombraAnterior = true;
    this.enquadrar();
  }

  enquadrar() {
    const largura = 13.4;
    const altura = this.altura + 0.5;
    const v = THREE.MathUtils.degToRad(this.camera.fov);
    const porAltura = altura / 2 / Math.tan(v / 2);
    const porLargura = largura / 2 / (Math.tan(v / 2) * this.camera.aspect);
    const dist = Math.max(porAltura, porLargura) * 1.04 + 0.8;
    this.alvoCamera = new THREE.Vector3(-0.55, altura * 0.4, 0);
    this.baseCamera = new THREE.Vector3(-0.55, altura * 0.62 + 0.5, dist);
  }

  redimensionar() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.enquadrar();
    this.forcar = true;
  }

  // ---------------------------------------------------------------- itens
  // Origem da gaveta: frente da câmara, na altura do topo da bandeja
  posicaoGaveta(indice) {
    const coluna = indice % this.colunas;
    const fileira = Math.floor(indice / this.colunas);
    return new THREE.Vector3(this.xCamara + (coluna - (this.colunas - 1) / 2) * PASSO_X, BASE_CAMARA + fileira * PASSO_Y + 0.18, Z_CAMARA);
  }

  posicao(indice) {
    const linha = Math.floor(indice / POR_PRATELEIRA);
    const coluna = indice % POR_PRATELEIRA;
    const x = CENTRO_ESQ + (coluna - (POR_PRATELEIRA - 1) / 2) * ESPACO;
    return linha === 0
      ? new THREE.Vector3(x, ALTURA_BALCAO + 0.06, 0.85)
      : new THREE.Vector3(x, ALTURA_BALCAO + linha * ENTRE_PRATELEIRAS, -0.85);
  }

  atualizar(itens) {
    this.forcar = true;
    this.sombraAnterior = true;
    const objetos = itens.filter((i) => i.tipo === 'objeto');
    const nCorpos = itens.length - objetos.length;
    const linhas = Math.max(2, Math.ceil(objetos.length / POR_PRATELEIRA));
    if (`${linhas}|${nCorpos}` !== this.assinatura) this.montarEstrutura(linhas, nCorpos);

    const agora = performance.now();
    const chaves = new Set(itens.map(chaveDe));
    this.entradas.forEach((e) => {
      if (!chaves.has(e.chave) && !e.saindo) e.saindo = agora;
    });
    let novos = 0;
    const indiceDe = { objeto: 0, corpo: 0 };
    itens.forEach((item) => {
      const eCorpo = item.tipo === 'corpo';
      const indice = indiceDe[item.tipo]++;
      const alvo = eCorpo ? this.posicaoGaveta(indice) : this.posicao(indice);
      let e = this.entradas.get(chaveDe(item));
      if (!e) {
        const grupo = new THREE.Group();
        if (eCorpo) {
          grupo.add(criarGaveta(item));
        } else {
          const modelo = criarModelo(item.categoria, item, TAMANHO[item.categoria] || 0.8);
          modelo.rotation.y = ((indice % 6) - 2.5) * 0.12;
          grupo.add(modelo);
        }
        // área de clique: uma caixa invisível, para o mouse não testar cada pedacinho do modelo
        const limite = new THREE.Box3().setFromObject(grupo);
        const tam = limite.getSize(new THREE.Vector3());
        const hit = new THREE.Mesh(new THREE.BoxGeometry(tam.x, tam.y, tam.z), new THREE.MeshBasicMaterial({ visible: false }));
        limite.getCenter(hit.position);
        hit.userData.chave = chaveDe(item);
        grupo.add(hit);
        e = { chave: chaveDe(item), item, grupo, hit, eCorpo, atual: alvo.clone(), hover: 0, inicioQueda: agora + novos++ * 110, queda: true };
        grupo.position.copy(e.atual);
        grupo.visible = false;
        grupo.userData.chave = e.chave;
        this.scene.add(grupo);
        this.entradas.set(e.chave, e);
      }
      e.item = item;
      e.alvo = alvo;
      e.saindo = 0; // voltou ao mural enquanto saía
    });
  }

  // O objeto gira e sobe antes de abrir em tela grande; a gaveta sai um pouco mais da câmara
  girar(chave, duracao = 550) {
    const e = this.entradas.get(chave);
    if (!e) return Promise.resolve();
    return new Promise((resolve) => {
      e.giro = { inicio: performance.now(), duracao, resolve };
    });
  }

  posicionarCamera() {
    const z = this.zoomT;
    this._p.set(this.baseCamera.x + this.parallax.x * 0.7 * (1 - z), this.baseCamera.y + this.parallax.y * 0.35 * (1 - z), this.baseCamera.z);
    this._a.copy(this.alvoCamera);
    if (z > 0) {
      this._p.lerp(this.camPorta, z);
      this._a.lerp(this.focoPorta, z);
    }
    this.camera.position.copy(this._p);
    this.camera.lookAt(this._a);
  }

  quadro() {
    if (!this.container.isConnected) return this.destruir(); // a tela foi trocada
    const agora = performance.now();
    const dt = Math.min(this.relogio.getDelta(), 0.05);
    if (this.pausado || this.compilando) return;
    const suave = 1 - Math.exp(-10 * dt);
    let mudou = this.forcar;
    let animando = false;
    this.forcar = false;

    if (this.zoomAnim) {
      const a = this.zoomAnim;
      const t = Math.min(1, (agora - a.inicio) / a.duracao);
      this.zoomT = a.de + (a.para - a.de) * easeInOut(t);
      if (t >= 1) {
        this.zoomAnim = null;
        a.resolve();
      }
      mudou = true;
      animando = true;
    }
    const alvoParallax = this.ponteiro.x > 5 ? ZERO2 : this.ponteiro;
    if (this.parallax.distanceToSquared(alvoParallax) > 1e-6) {
      this.parallax.lerp(alvoParallax, 0.05);
      mudou = true;
    }
    if (mudou) this.posicionarCamera();

    this.entradas.forEach((e, chave) => {
      const g = e.grupo;
      e.atual.lerp(e.alvo || e.atual, suave);
      let y = 0;
      let z = 0;
      let escala = 1;
      let giro = 0;
      const alvoHover = e.passando ? 1 : 0;
      if (e.queda || e.giro || e.saindo || Math.abs(e.hover - alvoHover) > 0.002 || (e.alvo && e.atual.distanceToSquared(e.alvo) > 1e-6)) animando = true;

      if (e.queda) {
        const t = (agora - e.inicioQueda) / 1000;
        if (t < 0) {
          g.visible = false;
          return;
        }
        g.visible = true;
        const k = Math.min(1, t);
        if (e.eCorpo) {
          z -= (1 - easeInOut(k)) * ALCANCE; // a gaveta desliza para fora da câmara
        } else {
          y += (1 - easeOutBounce(k)) * 5;
          giro += (1 - k) * 2.2;
        }
        if (k >= 1) e.queda = false;
      }
      e.hover += (alvoHover - e.hover) * suave;
      if (e.eCorpo) {
        z += e.hover * 0.1;
      } else {
        y += e.hover * 0.1;
        escala += e.hover * 0.05;
      }

      if (e.giro) {
        const t = Math.min(1, (agora - e.giro.inicio) / e.giro.duracao);
        if (e.eCorpo) {
          z += Math.sin(Math.PI * t) * 0.3;
        } else {
          giro += easeInOut(t) * Math.PI * 2;
          y += Math.sin(Math.PI * t) * 0.45;
          escala += Math.sin(Math.PI * t) * 0.35;
        }
        if (t >= 1) {
          e.giro.resolve();
          e.giro = null;
        }
      }
      if (e.saindo) {
        const t = Math.min(1, (agora - e.saindo) / 350);
        if (e.eCorpo) z -= easeInOut(t) * ALCANCE;
        else escala *= 1 - easeInOut(t);
        if (t >= 1) {
          this.scene.remove(g);
          liberar(g);
          this.entradas.delete(chave);
          return;
        }
      }
      g.position.set(e.atual.x, e.atual.y + y, e.atual.z + z);
      g.rotation.y = giro;
      g.scale.setScalar(Math.max(escala, 0.0001));
    });

    // LED do teclado: pisca em vermelho; verde quando o mouse está na porta
    if (this.led) {
      const estado = this.portaPassando ? 'v' : Math.sin(agora / 380) > -0.2 ? 'r' : 'a';
      if (estado !== this.estadoLed) {
        this.estadoLed = estado;
        this.led.material.color.set(estado === 'v' ? '#4dff88' : estado === 'r' ? '#ff3b3b' : '#4a1212');
        mudou = true;
      }
    }
    if (this.animPorta) {
      const a = this.animPorta;
      const t = Math.min(1, (agora - a.inicio) / a.duracao);
      this.portaAberta = a.de + (a.para - a.de) * easeInOut(t);
      this.folhaPorta.rotation.y = -ABERTURA_PORTA * this.portaAberta;
      if (t >= 1) {
        this.animPorta = null;
        a.resolve();
      }
      mudou = true;
      animando = true;
    }

    if (this.lampadas.atualizar(agora)) mudou = true;

    const sombra = animando || this.sombraAnterior;
    this.sombraAnterior = animando;
    if (!mudou && !animando && !sombra) return; // nada mudou: poupa a GPU
    this.renderer.shadowMap.needsUpdate = sombra;
    this.renderer.render(this.scene, this.camera);
    this.medirQuadro(agora);
  }

  // Resolução adaptativa: se os quadros ficam lentos enquanto algo se move, desenha com menos pixels (e volta quando melhora)
  medirQuadro(agora) {
    const ultimo = this.ultimoDesenho;
    this.ultimoDesenho = agora;
    if (ultimo === undefined || agora - ultimo > 100) return; // quadro isolado (a cena estava parada)
    this.mediaQuadro += (agora - ultimo - this.mediaQuadro) * 0.15;
    let razao = this.razao;
    if (this.mediaQuadro > 26 && razao > 0.7) razao = Math.max(0.7, razao - 0.1);
    else if (this.mediaQuadro < 15 && razao < this.razaoMaxima) razao = Math.min(this.razaoMaxima, razao + 0.05);
    if (Math.abs(razao - this.razao) > 0.01) {
      this.razao = razao;
      this.renderer.setPixelRatio(razao);
      this.renderer.setSize(this.container.clientWidth || 1, this.container.clientHeight || 1, false);
    }
  }

  // ---------------------------------------------------------------- mouse
  itemSob(evento) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
    this.ponteiro.copy(ndc);
    const raio = new THREE.Raycaster();
    raio.setFromCamera(ndc, this.camera);
    if (this.alvosPorta && raio.intersectObjects(this.alvosPorta, false).length) return PORTA;
    if (raio.intersectObjects(this.lampadas.alvos, false).length) {
      LAMPADA.item.titulo = this.lampadas.rotulo();
      return LAMPADA;
    }
    const caixas = [];
    this.entradas.forEach((e) => {
      if (e.grupo.visible && !e.saindo && e.hit) caixas.push(e.hit);
    });
    const [acerto] = raio.intersectObjects(caixas, false);
    return acerto ? this.entradas.get(acerto.object.userData.chave) : null;
  }

  aoMover(evento) {
    const e = this.itemSob(evento);
    this.portaPassando = e === PORTA;
    this.entradas.forEach((x) => (x.passando = x === e));
    this.renderer.domElement.style.cursor = e ? 'pointer' : 'default';
    this.aoPassar?.(e ? e.item : null, evento.clientX, evento.clientY);
  }

  sairDoPonteiro() {
    this.portaPassando = false;
    this.ponteiro.set(9, 9);
    this.entradas.forEach((x) => (x.passando = false));
    this.aoPassar?.(null);
  }

  aoSoltar(evento) {
    if (!this.inicio || Math.hypot(evento.clientX - this.inicio.x, evento.clientY - this.inicio.y) > 6) return;
    const e = this.itemSob(evento);
    if (e === LAMPADA) {
      this.lampadas.alternar();
      return;
    }
    if (e) this.aoClicar?.(e.item);
  }

  destruir() {
    if (this.destruida) return;
    this.destruida = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    this.entradas.forEach((e) => liberar(e.grupo));
    liberar(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // devolve a GPU na hora, sem esperar o navegador
    this.renderer.domElement.remove();
  }
}
