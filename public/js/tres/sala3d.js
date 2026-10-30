// A sala do administrador em 3D: o painel numa TV na parede, o estoque em prateleiras e na câmara fria
// e as manifestações numa pasta sobre a mesa. Clicar em cada um abre a tela correspondente.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as tex from './texturas.js';
import { fundir } from './modelos.js';
import { criarPorta, ABERTURA_PORTA } from './porta.js';
import { criarLampadas, ajustarLuzes } from './lampadas.js';
import {
  criarPlanta, criarCadeira, criarComputador, criarArquivo, criarBebedouro, criarQuadroAvisos, criarRelogioParede, criarTapete, criarLixeira,
} from './decoracao.js';

const Z_PAREDE = -1.3;
const X_PORTA = -6.5; // a porta de saída fica no mesmo lugar da porta de entrada da recepção
const ZERO2 = new THREE.Vector2();
const LAMPADA = { userData: { acao: 'luz', rotulo: '' } };
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const FONTE = 'Arial, "Segoe UI", system-ui, sans-serif';
const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, ...o });
const caixa = (w, h, d, m, r = 0.01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);

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

export class Sala3D {
  constructor(container, { aoClicar, aoPassar }) {
    this.container = container;
    this.aoClicar = aoClicar;
    this.aoPassar = aoPassar;
    this.clicaveis = [];
    this.ponteiro = new THREE.Vector2(9, 9);
    this.parallax = new THREE.Vector2();
    this.relogio = new THREE.Clock();
    this.pendentes = 0;
    this.pastaAberta = 0;
    this.pastaForcada = false;
    this.zoomT = 0;
    this.portaAberta = 0;
    this._p = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this.forcar = true;
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
    this.altura = 4.7;
    this.montarAmbiente();
    this.montarTV();
    this.montarPrateleiras();
    this.montarCamaraFria();
    this.montarMesa();
    this.montarSaida();
    this.montarDecoracao();
    this.clicaveis.forEach((g) => this.prepararRealce(g));
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
    const azulejo = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 2.4),
      new THREE.MeshStandardMaterial({ map: tex.azulejoParede({ x: 80 / 1.2, y: 2 }), roughness: 0.25 })
    );
    azulejo.position.set(0, 1.2, Z_PAREDE);
    const pintada = new THREE.Mesh(new THREE.PlaneGeometry(80, 14), new THREE.MeshStandardMaterial({ color: '#cfe0df', roughness: 0.9 }));
    pintada.position.set(0, 9.4, Z_PAREDE);
    const faixa = new THREE.Mesh(new THREE.BoxGeometry(80, 0.1, 0.04), mat('#0f5e66', { roughness: 0.5 }));
    faixa.position.set(0, 2.4, Z_PAREDE + 0.02);
    const rodape = new THREE.Mesh(new THREE.BoxGeometry(80, 0.14, 0.03), mat('#59666b', { roughness: 0.6 }));
    rodape.position.set(0, 0.07, Z_PAREDE + 0.015);
    [azulejo, pintada].forEach((p) => (p.receiveShadow = true));
    this.scene.add(piso, azulejo, pintada, faixa, rodape);
    this.lampadas = criarLampadas(this.scene, {
      posicoes: [[-3.9, 2.4, 2.4], [-0.5, 2.4, 2.4], [2.9, 2.4, 2.4]],
      y: 4.8,
      aoMudar: (t) => this.aplicarLuz(t),
    });
  }

  // Brilho geral conforme as luminárias: apagadas, só sobra uma luz fraca
  aplicarLuz(t) {
    ajustarLuzes(this.scene, { dir: this.luzDir, hemi: this.luzHemi }, t);
    this.forcar = true;
  }

  // Marca o grupo como clicável: guarda os materiais para o brilho ao passar o mouse
  registrar(grupo, { acao, destino, rotulo }) {
    grupo.userData = { ...grupo.userData, acao, destino, rotulo, brilho: 0, mats: [] };
    grupo.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.clicaveis.push(grupo);
    this.scene.add(grupo);
  }

  prepararRealce(grupo) {
    const vistos = new Set();
    grupo.traverse((o) => {
      if (!o.isMesh) return;
      [].concat(o.material).forEach((m) => {
        if (m.isMeshStandardMaterial && !vistos.has(m)) {
          vistos.add(m);
          m.emissive.set('#1d8e9c');
          m.emissiveIntensity = 0; // só brilha com o mouse em cima
          grupo.userData.mats.push(m);
        }
      });
    });
  }

  // ---------------------------------------------------------------- TV (painel)
  montarTV() {
    const g = new THREE.Group();
    g.position.set(0, 3.2, Z_PAREDE + 0.1);
    const moldura = caixa(4.0, 2.34, 0.12, mat('#0b0f11', { roughness: 0.4, metalness: 0.5 }), 0.04);
    this.tvCanvas = document.createElement('canvas');
    this.tvCanvas.width = 1024;
    this.tvCanvas.height = 576;
    this.tvTextura = new THREE.CanvasTexture(this.tvCanvas);
    this.tvTextura.colorSpace = THREE.SRGBColorSpace;
    this.tvTextura.anisotropy = 8;
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.14), new THREE.MeshBasicMaterial({ map: this.tvTextura, toneMapped: false }));
    tela.position.z = 0.062;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: '#4dff88' }));
    led.position.set(1.8, -1.2, 0.065);
    const suporte = caixa(0.9, 0.08, 0.2, mat('#2b3338', { metalness: 0.7, roughness: 0.4 }), 0.02);
    suporte.position.set(0, -1.22, -0.02);
    g.add(moldura, tela, led, suporte);
    this.registrar(g, { acao: 'painel', destino: '#/admin/painel', rotulo: 'Painel · TV' });
    this.tv = g;
    this.desenharTV(null);
  }

  // Desenha o painel na tela da TV com os números do sistema
  desenharTV(d) {
    const g = this.tvCanvas.getContext('2d');
    g.setTransform(0.8, 0, 0, 0.8, 0, 0); // o desenho foi feito para 1280×720
    const grad = g.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#0a2a31');
    grad.addColorStop(1, '#14505a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1280, 720);
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.fillRect(0, 0, 1280, 96);
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.font = `700 44px ${FONTE}`;
    g.fillText('PAINEL · IML', 48, 50);
    g.textAlign = 'right';
    g.fillStyle = '#8fd0d4';
    g.font = `600 30px ${FONTE}`;
    g.fillText('clique para abrir', 1232, 50);
    g.textAlign = 'left';

    if (!d) {
      g.fillStyle = '#ffffff';
      g.font = `600 40px ${FONTE}`;
      g.fillText('carregando…', 48, 200);
      this.tvTextura.needsUpdate = true;
      this.forcar = true;
      return;
    }
    const blocos = [['NA FILA', d.fila, '#ffd166'], ['OBJETOS', d.objetos, '#8fd0d4'], ['CORPOS', d.corpos, '#ff8fa3'], ['MANIFESTAÇÕES', d.manifestacoes, '#c3e88d']];
    blocos.forEach(([nome, valor, cor], i) => {
      const x = 48 + i * 300;
      g.fillStyle = 'rgba(255,255,255,.1)';
      g.beginPath();
      g.roundRect(x, 130, 270, 190, 22);
      g.fill();
      g.fillStyle = cor;
      g.font = `700 100px ${FONTE}`;
      g.fillText(String(valor), x + 26, 215);
      g.fillStyle = '#d6e8ea';
      g.font = `600 26px ${FONTE}`;
      g.fillText(nome, x + 26, 288);
    });

    g.fillStyle = '#ffffff';
    g.font = `700 32px ${FONTE}`;
    g.fillText(`Câmara fria · ${d.gavetas} de ${d.capacidade} gavetas`, 48, 380);
    g.fillStyle = 'rgba(255,255,255,.15)';
    g.beginPath();
    g.roundRect(48, 410, 520, 30, 15);
    g.fill();
    g.fillStyle = '#ff8fa3';
    g.beginPath();
    g.roundRect(48, 410, Math.max(30, 520 * (d.gavetas / d.capacidade)), 30, 15);
    g.fill();

    g.fillStyle = '#ffffff';
    g.font = `700 32px ${FONTE}`;
    g.fillText('Atividade recente', 640, 380);
    g.font = `500 27px ${FONTE}`;
    g.fillStyle = '#d6e8ea';
    (d.eventos || []).slice(0, 5).forEach((e, i) => g.fillText(`• ${e}`.slice(0, 40), 640, 430 + i * 44));
    g.fillStyle = '#8fd0d4';
    g.font = `500 26px ${FONTE}`;
    g.fillText(new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }), 48, 676);
    this.tvTextura.needsUpdate = true;
    this.forcar = true;
  }

  atualizarTV(d) {
    this.desenharTV(d);
  }

  // ---------------------------------------------------------------- estoque: prateleiras com caixas
  montarPrateleiras() {
    const g = new THREE.Group();
    g.position.set(-3.85, 0, -0.95);
    const inox = mat('#c3ccd1', { metalness: 0.9, roughness: 0.3 });
    [-1.42, 1.42].forEach((x) => [-0.33, 0.33].forEach((z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.7, 0.05), inox);
      p.position.set(x, 1.35, z);
      g.add(p);
    }));
    [0.1, 0.98, 1.86, 2.7].forEach((y) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.05, 0.72), inox);
      t.position.set(0, y, 0);
      g.add(t);
    });
    const kraft = ['#c9a36b', '#bf9658', '#d4b07a', '#b98f55'];
    [0.125, 1.005, 1.885].forEach((base, linha) => {
      for (let i = 0; i < 4; i++) {
        const alto = 0.36 + ((i + linha) % 3) * 0.05;
        const c = caixa(0.58, alto, 0.54, mat(kraft[(i + linha) % 4], { roughness: 0.9 }), 0.008);
        c.position.set(-1.0 + i * 0.68, base + alto / 2, 0);
        const rotulo = new THREE.Mesh(
          new THREE.PlaneGeometry(0.34, 0.07),
          new THREE.MeshStandardMaterial({ map: tex.letreiro(`OBJ ${String.fromCharCode(65 + linha)}-0${i + 1}`, { fundo: '#f6efd8', cor: '#5b4520', borda: '#8a6a2c' }), roughness: 0.8 })
        );
        rotulo.position.set(0, alto * 0.1, 0.272);
        c.add(rotulo);
        g.add(c);
      }
    });
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.4), new THREE.MeshStandardMaterial({ map: tex.letreiro('ESTOQUE · OBJETOS'), roughness: 0.6 }));
    placa.position.set(0, 3.2, 0.63);
    g.add(placa);
    fundir(g);
    this.registrar(g, { acao: 'estoque', destino: '#/admin/objetos', rotulo: 'Estoque · objetos' });
  }

  // ---------------------------------------------------------------- estoque: câmara fria dos corpos
  montarCamaraFria() {
    const g = new THREE.Group();
    g.position.set(4.4, 0, -0.8);
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.5, 1.0), mat('#8f9ba1', { metalness: 0.85, roughness: 0.4 }));
    corpo.position.y = 1.25;
    g.add(corpo);
    for (let i = 0; i < 9; i++) {
      const porta = new THREE.Mesh(
        new THREE.PlaneGeometry(0.82, 0.7),
        new THREE.MeshStandardMaterial({ map: tex.portaInox(`G-${String(i + 1).padStart(2, '0')}`), metalness: 0.5, roughness: 0.4 })
      );
      porta.position.set(((i % 3) - 1) * 0.9, 0.5 + Math.floor(i / 3) * 0.78, 0.503);
      g.add(porta);
    }
    const placa = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.4),
      new THREE.MeshStandardMaterial({ map: tex.letreiro('ESTOQUE · CORPOS', { fundo: '#7a1f2b', borda: '#e0a3ac' }), roughness: 0.6 })
    );
    placa.position.set(0, 3.0, 0.5 - 0.03);
    g.add(placa);
    this.registrar(g, { acao: 'estoque', destino: '#/admin/corpos', rotulo: 'Estoque · corpos' });
  }

  // ---------------------------------------------------------------- mesa com a pasta de manifestações
  montarMesa() {
    const mesa = new THREE.Group();
    mesa.position.set(0, 0, 0.95);
    const madeira = mat('#a07c52', { roughness: 0.65 });
    const tampo = caixa(3.4, 0.07, 1.35, madeira, 0.02);
    tampo.position.y = 0.925;
    mesa.add(tampo);
    [[-1.55, -0.55], [1.55, -0.55], [-1.55, 0.55], [1.55, 0.55]].forEach(([x, z]) => {
      const p = caixa(0.09, 0.9, 0.09, mat('#5d4630'), 0.01);
      p.position.set(x, 0.45, z);
      mesa.add(p);
    });
    const gaveta = caixa(1.2, 0.2, 0.04, mat('#8d6b44', { roughness: 0.7 }), 0.01);
    gaveta.position.set(0.9, 0.78, 0.67);
    mesa.add(gaveta);
    mesa.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.scene.add(mesa);

    // abajur e caneca, só de enfeite
    const abajur = new THREE.Group();
    abajur.position.set(-1.35, 0.96, 0.62);
    const baseA = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.04, 24), mat('#2b3338', { metalness: 0.6 }));
    const braco = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), mat('#2b3338', { metalness: 0.6 }));
    braco.position.set(0, 0.27, 0);
    braco.rotation.z = 0.25;
    const cupula = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#0f5e66', roughness: 0.5, side: THREE.DoubleSide, emissive: '#7fd7e0', emissiveIntensity: 0.25 }));
    cupula.position.set(0.07, 0.55, 0);
    abajur.add(baseA, braco, cupula);
    abajur.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.scene.add(abajur);
    const caneca = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.1, 20), mat('#f4f1ec', { roughness: 0.4 }));
    caneca.position.set(1.3, 1.01, 0.35);
    caneca.castShadow = true;
    this.scene.add(caneca);

    // a pasta (manila), com papéis saindo e um selo vermelho com o número de manifestações na fila
    const pasta = new THREE.Group();
    pasta.position.set(0.1, 0.965, 0.95);
    pasta.rotation.y = -0.14;
    pasta.scale.setScalar(1.3);
    const manila = mat('#e3bb6c', { roughness: 0.8 });
    const fundo = caixa(0.98, 0.022, 0.7, manila, 0.006);
    fundo.position.set(0, 0.011, 0);
    pasta.add(fundo);
    [[0.02, 0.026, 0.01], [-0.02, 0.034, -0.01], [0.01, 0.042, 0.02]].forEach(([dx, y, dz], i) => {
      const folha = caixa(0.9, 0.006, 0.62, mat('#fbfaf6', { roughness: 0.9 }), 0.001);
      folha.position.set(dx, y, dz);
      folha.rotation.y = (i - 1) * 0.03;
      pasta.add(folha);
    });
    this.capa = new THREE.Group();
    this.capa.position.set(0, 0.052, -0.35);
    const capaMalha = caixa(0.98, 0.022, 0.7, manila, 0.006);
    capaMalha.position.set(0, 0, 0.35);
    const aba = caixa(0.34, 0.022, 0.07, manila, 0.006);
    aba.position.set(-0.3, 0, -0.02);
    const rotulo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.17),
      new THREE.MeshStandardMaterial({ map: tex.letreiro('MANIFESTAÇÕES', { fundo: '#f6efd8', cor: '#5b4520', borda: '#8a6a2c' }), roughness: 0.8 })
    );
    rotulo.rotation.x = -Math.PI / 2;
    rotulo.position.set(0, 0.0125, 0.35);
    this.selo = new THREE.Mesh(new THREE.CircleGeometry(0.075, 28), new THREE.MeshBasicMaterial({ transparent: true }));
    this.selo.rotation.x = -Math.PI / 2;
    this.selo.position.set(0.38, 0.0135, 0.14);
    this.seloCanvas = document.createElement('canvas');
    this.seloCanvas.width = 128;
    this.seloCanvas.height = 128;
    this.seloTextura = new THREE.CanvasTexture(this.seloCanvas);
    this.seloTextura.colorSpace = THREE.SRGBColorSpace;
    this.selo.material.map = this.seloTextura;
    this.selo.visible = false;
    this.capa.add(capaMalha, aba, rotulo, this.selo);
    pasta.add(this.capa);
    this.pasta = pasta;
    this.registrar(pasta, { acao: 'pasta', destino: '#/admin/manifestacoes', rotulo: 'Manifestações' });
    // área de clique maior que a pasta, para ser fácil de acertar
    const area = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.85), new THREE.MeshBasicMaterial({ visible: false }));
    area.position.y = 0.15;
    pasta.add(area);
  }

  // Número de manifestações na fila, no selo da pasta
  atualizarPendentes(n) {
    this.pendentes = n;
    this.selo.visible = n > 0;
    const g = this.seloCanvas.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#d6405a';
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `700 74px ${FONTE}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 64, 70);
    this.seloTextura.needsUpdate = true;
    this.forcar = true;
  }

  // A pasta abre antes de a lista aparecer; resolve quando termina
  abrirPasta() {
    this.pastaForcada = true;
    return new Promise((resolve) => setTimeout(resolve, 520));
  }

  fecharPasta() {
    this.pastaForcada = false;
  }

  // ---------------------------------------------------------------- móveis e enfeites (só para compor o cenário)
  montarDecoracao() {
    const por = (o, x, y, z, giro = 0) => {
      o.position.set(x, y, z);
      o.rotation.y = giro;
      this.scene.add(o);
      return o;
    };
    por(criarTapete(4.6, 2.7), 0, 0.004, 1.0);
    por(criarCadeira(), 0.4, 0, 0.12, -0.35); // atrás da mesa
    por(criarComputador(), -0.85, 0.96, 0.72, 0.12); // em cima da mesa
    por(criarArquivo(), 2.1, 0, -0.95);
    por(criarBebedouro(), 2.68, 0, -1.0);
    por(criarQuadroAvisos(), 2.6, 3.0, Z_PAREDE + 0.03);
    por(criarRelogioParede(), 2.6, 4.1, Z_PAREDE + 0.03);
    por(criarPlanta(1.1), -5.6, 0, 1.6);
    por(criarPlanta(1.3), 6.2, 0, 0.1);
    por(criarLixeira(), -1.95, 0, 1.2);
  }

  // ---------------------------------------------------------------- porta de saída (volta à recepção)
  montarSaida() {
    const p = criarPorta({ rotulo: 'SAÍDA · RECEPÇÃO', fundo: '#1f7a3d', borda: '#a6d9b5' });
    p.grupo.position.set(X_PORTA, 0, Z_PAREDE);
    this.folhaPorta = p.folha;
    this.registrar(p.grupo, { acao: 'sair', destino: '#/', rotulo: 'Sair para a recepção' });
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

  zoomPorta(entrar = true, duracao = 1300) {
    return new Promise((resolve) => {
      this.zoomAnim = { de: this.zoomT, para: entrar ? 1 : 0, inicio: performance.now(), duracao, resolve };
    });
  }

  // Chegada pela porta: a câmera começa colada nela e se afasta, enquanto a porta se fecha
  introEntrada() {
    this.zoomT = 1;
    this.portaAberta = 1;
    this.folhaPorta.rotation.y = -ABERTURA_PORTA;
    this.forcar = true;
    setTimeout(() => this.animarPorta(0, 900), 450);
    return this.zoomPorta(false, 1500);
  }

  // Quando uma janela cobre a sala, a cena para de desenhar
  pausar(p) {
    this.pausado = p;
    if (!p) {
      this.forcar = true;
      this.relogio.getDelta();
    }
  }

  // ---------------------------------------------------------------- câmera
  enquadrar() {
    const largura = 13.4;
    const altura = this.altura + 0.5;
    const v = THREE.MathUtils.degToRad(this.camera.fov);
    const porAltura = altura / 2 / Math.tan(v / 2);
    const porLargura = largura / 2 / (Math.tan(v / 2) * this.camera.aspect);
    const dist = Math.max(porAltura, porLargura) * 1.04 + 0.8;
    this.alvoCamera = new THREE.Vector3(-0.6, altura * 0.4, 0);
    this.baseCamera = new THREE.Vector3(-0.6, altura * 0.62 + 0.5, dist);
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
    let moveu = false; // algo com sombra mudou de lugar
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
    }
    const alvoParallax = this.ponteiro.x > 5 ? ZERO2 : this.ponteiro;
    if (this.parallax.distanceToSquared(alvoParallax) > 1e-6) {
      this.parallax.lerp(alvoParallax, 0.05);
      mudou = true;
    }
    if (mudou) this.posicionarCamera();

    this.clicaveis.forEach((g) => {
      const u = g.userData;
      const alvo = g === this.sob ? 1 : 0;
      if (Math.abs(u.brilho - alvo) > 0.003) {
        u.brilho += (alvo - u.brilho) * suave;
        u.mats.forEach((m) => (m.emissiveIntensity = u.brilho * 0.4));
        if (g === this.tv) this.tv.scale.setScalar(1 + u.brilho * 0.012);
        mudou = true;
      }
    });
    const alvoPasta = this.pastaForcada ? 1 : this.sob === this.pasta ? 0.16 : 0;
    if (Math.abs(alvoPasta - this.pastaAberta) > 0.002) {
      this.pastaAberta += (alvoPasta - this.pastaAberta) * suave;
      this.capa.rotation.x = -this.pastaAberta * 1.3;
      this.pasta.position.y = 0.965 + this.pastaAberta * 0.03;
      mudou = moveu = true;
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
      mudou = moveu = true;
    }

    if (this.lampadas.atualizar(agora)) mudou = true;

    const sombra = moveu || this.sombraAnterior;
    this.sombraAnterior = moveu;
    if (!mudou && !sombra) return; // nada mudou: poupa a GPU
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
  grupoSob(evento) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
    this.ponteiro.copy(ndc);
    const raio = new THREE.Raycaster();
    raio.setFromCamera(ndc, this.camera);
    if (raio.intersectObjects(this.lampadas.alvos, false).length) {
      LAMPADA.userData.rotulo = this.lampadas.rotulo();
      return LAMPADA;
    }
    const [acerto] = raio.intersectObjects(this.clicaveis, true);
    if (!acerto) return null;
    let o = acerto.object;
    while (o && !o.userData.acao) o = o.parent;
    return o || null;
  }

  rotuloDe(g) {
    return g === this.pasta && this.pendentes ? `Manifestações · ${this.pendentes} na fila` : g.userData.rotulo;
  }

  aoMover(evento) {
    this.sob = this.grupoSob(evento);
    this.renderer.domElement.style.cursor = this.sob ? 'pointer' : 'default';
    this.aoPassar?.(this.sob ? this.rotuloDe(this.sob) : null, evento.clientX, evento.clientY);
  }

  sairDoPonteiro() {
    this.ponteiro.set(9, 9);
    this.sob = null;
    this.aoPassar?.(null);
  }

  aoSoltar(evento) {
    if (!this.inicio || Math.hypot(evento.clientX - this.inicio.x, evento.clientY - this.inicio.y) > 6) return;
    const g = this.grupoSob(evento);
    if (g?.userData.acao === 'luz') {
      this.lampadas.alternar();
      return;
    }
    if (g) this.aoClicar?.({ acao: g.userData.acao, destino: g.userData.destino });
  }

  destruir() {
    if (this.destruida) return;
    this.destruida = true;
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    liberar(this.scene);
    this.tvTextura.dispose();
    this.seloTextura.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // devolve a GPU na hora, sem esperar o navegador
    this.renderer.domElement.remove();
  }
}
