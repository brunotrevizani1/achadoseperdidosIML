// A barraca de achados e perdidos em 3D (three.js)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { criarModelo, criarPes } from './modelos.js';
import * as tex from './texturas.js';

const POR_PRATELEIRA = 5;
const ESPACO = 1.2; // distância entre os itens
const ALTURA_BALCAO = 1.0;
const ENTRE_PRATELEIRAS = 0.95;
const LARGURA = 9.4; // barraca inteira
const LARGURA_ESQ = 6.4; // balcão e estantes dos objetos (lado esquerdo)
const CENTRO_ESQ = -1.5;
const X_CORTINA = 3.3; // centro da cortina dos corpos (lado direito)
const LARGURA_CORTINA = 2.8;
const ALTURA_BAINHA = 0.95;
const TAMANHO = { CELULAR: 0.95, DOCUMENTO: 0.9, ALIANCA: 0.65, MOCHILA: 1.05, CARTEIRA: 0.9, JOIA: 0.92, ROUPA: 1.0, CHAVES: 0.85, OUTRO: 1.0, PESSOA: 1.6 };

const easeOutBounce = (t) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, metalness: 0, ...o });
const chaveDe = (i) => `${i.tipo}-${i.id}`;

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
    this.linhas = 0;
    this.estrutura = null;
    this.ponteiro = new THREE.Vector2(9, 9);
    this.parallax = new THREE.Vector2();
    this.relogio = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = tex.ceu();
    this.scene.fog = new THREE.Fog('#e3ecf2', 22, 60);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.montarAmbiente();
    this.montarEstrutura(2);
    this.redimensionar();

    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(container);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', (e) => this.aoMover(e));
    canvas.addEventListener('pointerleave', () => this.sairDoPonteiro());
    canvas.addEventListener('pointerdown', (e) => (this.inicio = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => this.aoSoltar(e));

    this.renderer.setAnimationLoop(() => this.quadro());
  }

  // ---------------------------------------------------------------- cenário
  montarAmbiente() {
    const sol = new THREE.DirectionalLight('#fff0d6', 2.6);
    sol.position.set(5, 9, 8);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 8, bottom: -3, near: 1, far: 32 });
    sol.shadow.bias = -0.0004;
    sol.shadow.normalBias = 0.03;
    this.scene.add(sol, new THREE.HemisphereLight('#cfe6ff', '#8a7a68', 0.7));

    const calcada = tex.calcada();
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshStandardMaterial({ map: calcada, roughness: 0.95 }));
    chao.rotation.x = -Math.PI / 2;
    chao.position.z = 8;
    chao.receiveShadow = true;
    this.scene.add(chao);

    // Prédios ao fundo
    const cores = ['#cdb89a', '#b9a0a0', '#a8b9a0', '#c9c2b0', '#aab4c4'];
    for (let i = -3; i <= 3; i++) {
      const h = 9 + ((i * 7) % 5) + 3;
      const m = new THREE.MeshStandardMaterial({ map: tex.fachada(cores[Math.abs(i) % cores.length]), roughness: 0.9 });
      m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
      m.map.repeat.set(2, 1.5);
      const predio = new THREE.Mesh(new THREE.BoxGeometry(8.4, h, 6), m);
      predio.position.set(i * 8.6, h / 2, -13);
      this.scene.add(predio);
    }
    // Caixotes ao lado da barraca
    const madeira = tex.madeira('#a9824f');
    [[-5.9, 0.3, 0.5, 0.6], [-5.75, 0.9, 0.55, 0.5], [6.1, 0.3, 0.2, 0.6]].forEach(([x, y, z, t]) => {
      const c = new THREE.Mesh(new RoundedBoxGeometry(t, t, t, 3, 0.02), new THREE.MeshStandardMaterial({ map: madeira, roughness: 0.85 }));
      c.position.set(x, y, z);
      c.rotation.y = x * 0.2;
      c.castShadow = c.receiveShadow = true;
      this.scene.add(c);
    });
  }

  // Esqueleto da barraca: balcão, estante, postes e toldo. Cresce com o número de fileiras
  montarEstrutura(linhas) {
    if (this.estrutura) {
      this.scene.remove(this.estrutura);
      liberar(this.estrutura);
    }
    this.linhas = linhas;
    const g = new THREE.Group();
    const topoPrateleira = ALTURA_BALCAO + (linhas - 1) * ENTRE_PRATELEIRAS;
    const altoFrente = topoPrateleira + 1.3; // o toldo fica acima dos itens para não escondê-los
    const altoTras = altoFrente + 0.75;
    this.altura = altoTras;

    const tabua = tex.madeira('#a0723f', { x: 2, y: 1 });
    const escura = tex.madeira('#6e4a28');
    const mTabua = new THREE.MeshStandardMaterial({ map: tabua, roughness: 0.8 });
    const mEscura = new THREE.MeshStandardMaterial({ map: escura, roughness: 0.85 });
    const parte = (geo, m, x, y, z) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      g.add(o);
      return o;
    };

    // Balcão
    parte(new RoundedBoxGeometry(LARGURA_ESQ + 0.3, ALTURA_BALCAO, 0.9, 3, 0.02), mTabua, CENTRO_ESQ, ALTURA_BALCAO / 2, 0.85);
    parte(new THREE.BoxGeometry(LARGURA_ESQ + 0.5, 0.06, 1.05), mEscura, CENTRO_ESQ, ALTURA_BALCAO + 0.03, 0.85);
    const letreiro = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.66), new THREE.MeshStandardMaterial({ map: tex.letreiro('ACHADOS & PERDIDOS'), roughness: 0.6 }));
    letreiro.position.set(CENTRO_ESQ, 0.5, 1.305);
    g.add(letreiro);

    // Fundo: painel de madeira e estante
    parte(new THREE.BoxGeometry(LARGURA + 0.4, altoTras, 0.08), mEscura, 0, altoTras / 2, -1.25);
    for (let r = 1; r < linhas; r++) {
      parte(new THREE.BoxGeometry(LARGURA_ESQ, 0.07, 0.7), mTabua, CENTRO_ESQ, ALTURA_BALCAO + r * ENTRE_PRATELEIRAS - 0.035, -0.85);
    }
    // Caixotes embaixo da estante, escondidos atrás do balcão
    parte(new THREE.BoxGeometry(LARGURA_ESQ, 0.9, 0.7), mEscura, CENTRO_ESQ, 0.45, -0.85);

    // Postes e travessas
    const poste = new THREE.CylinderGeometry(0.07, 0.07, 1, 14);
    [[-4.95, 1.5, altoFrente], [4.95, 1.5, altoFrente], [-4.95, -1.3, altoTras], [4.95, -1.3, altoTras]].forEach(([x, z, alt]) => {
      const p = parte(poste, mTabua, x, alt / 2, z);
      p.scale.y = alt;
    });
    parte(new THREE.BoxGeometry(LARGURA + 0.6, 0.1, 0.1), mTabua, 0, altoFrente - 0.05, 1.5);
    parte(new THREE.BoxGeometry(LARGURA + 0.6, 0.1, 0.1), mTabua, 0, altoTras - 0.05, -1.3);
    [-4.95, 4.95].forEach((x) => {
      const lado = parte(new THREE.BoxGeometry(0.09, 0.09, 2.9), mTabua, x, (altoFrente + altoTras) / 2 - 0.05, 0.1);
      lado.rotation.x = Math.atan2(altoTras - altoFrente, 2.8);
    });

    // Toldo de lona com ondulações entre os postes
    const nx = 72;
    const ny = 12;
    const geo = new THREE.PlaneGeometry(LARGURA + 1.2, 1, nx, ny);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const t = 1 - uv.getY(i);
      const x = pos.getX(i);
      const onda = -0.05 * Math.sin(x * 4.4) * Math.sin(Math.PI * t) - 0.1 * Math.sin(Math.PI * t) * 0.4;
      pos.setXYZ(i, x, altoTras - (altoTras - altoFrente) * t + onda, -1.4 + 3.2 * t);
    }
    geo.computeVertexNormals();
    const lonaTex = tex.lona('#d8402c', 18);
    const toldo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: lonaTex, roughness: 0.92, side: THREE.DoubleSide }));
    toldo.castShadow = toldo.receiveShadow = true;
    g.add(toldo);
    const bando = new THREE.Mesh(
      new THREE.PlaneGeometry(LARGURA + 1.2, 0.42),
      new THREE.MeshStandardMaterial({ map: tex.bando('#d8402c', 18), roughness: 0.92, side: THREE.DoubleSide, alphaTest: 0.5 })
    );
    bando.position.set(0, altoFrente - 0.21, 1.8);
    bando.castShadow = true;
    g.add(bando);

    // Cortina do lado direito: só os pés dos corpos aparecem por baixo
    const topoCortina = altoFrente + 0.35;
    const cortinaGeo = new THREE.PlaneGeometry(LARGURA_CORTINA, topoCortina - ALTURA_BAINHA, 64, 8);
    const cp = cortinaGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i);
      cp.setXYZ(i, x, cp.getY(i) + (topoCortina + ALTURA_BAINHA) / 2, 0.5 + Math.sin(x * 9) * 0.045);
    }
    cortinaGeo.computeVertexNormals();
    const cortina = new THREE.Mesh(cortinaGeo, new THREE.MeshStandardMaterial({ color: '#6f2236', roughness: 0.92, side: THREE.DoubleSide }));
    cortina.position.x = X_CORTINA;
    cortina.castShadow = cortina.receiveShadow = true;
    g.add(cortina);
    const varao = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, LARGURA_CORTINA + 0.3, 12), new THREE.MeshStandardMaterial({ color: '#cfa24a', metalness: 1, roughness: 0.3 }));
    varao.rotation.z = Math.PI / 2;
    varao.position.set(X_CORTINA, topoCortina, 0.5);
    g.add(varao);
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.34), new THREE.MeshStandardMaterial({ map: tex.letreiro('NÃO IDENTIFICADOS'), roughness: 0.6 }));
    placa.position.set(X_CORTINA, 2.05, 0.56);
    g.add(placa);

    this.estrutura = g;
    this.scene.add(g);
    this.enquadrar();
  }

  enquadrar() {
    const largura = 12;
    const altura = this.altura + 0.5;
    const v = THREE.MathUtils.degToRad(this.camera.fov);
    const porAltura = altura / 2 / Math.tan(v / 2);
    const porLargura = largura / 2 / (Math.tan(v / 2) * this.camera.aspect);
    const dist = Math.max(porAltura, porLargura) * 1.04 + 0.8;
    this.alvoCamera = new THREE.Vector3(0, altura * 0.4, 0);
    this.baseCamera = new THREE.Vector3(0, altura * 0.62 + 0.5, dist);
  }

  redimensionar() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.enquadrar();
  }

  // ---------------------------------------------------------------- itens
  // Corpos: pares de pés lado a lado sob a cortina; se não couberem, uma segunda fileira atrás
  posicaoPessoa(indice, total) {
    const porFileira = 4;
    const fileira = Math.floor(indice / porFileira);
    const naFileira = Math.min(porFileira, total - fileira * porFileira);
    const passo = LARGURA_CORTINA / porFileira;
    const x = X_CORTINA + ((indice % porFileira) - (naFileira - 1) / 2) * passo + (fileira % 2) * 0.1;
    return new THREE.Vector3(x, 0, 0.5 - fileira * 0.38);
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
    const objetos = itens.filter((i) => i.tipo === 'objeto');
    const pessoas = itens.filter((i) => i.tipo === 'corpo');
    const linhas = Math.max(2, Math.ceil(objetos.length / POR_PRATELEIRA));
    if (linhas !== this.linhas) this.montarEstrutura(linhas);

    const agora = performance.now();
    const chaves = new Set(itens.map(chaveDe));
    this.entradas.forEach((e, k) => {
      if (!chaves.has(k) && !e.saindo) {
        e.saindo = agora;
      }
    });
    let novos = 0;
    const indiceDe = { objeto: 0, corpo: 0 };
    itens.forEach((item) => {
      const eCorpo = item.tipo === 'corpo';
      const indice = indiceDe[item.tipo]++;
      const alvo = eCorpo ? this.posicaoPessoa(indice, pessoas.length) : this.posicao(indice);
      let e = this.entradas.get(chaveDe(item));
      if (!e) {
        const grupo = new THREE.Group();
        if (eCorpo) {
          grupo.add(criarPes(item));
        } else {
          const modelo = criarModelo(item.categoria, item, TAMANHO[item.categoria] || 0.8);
          modelo.rotation.y = ((indice % 5) - 2) * 0.12;
          grupo.add(modelo);
        }
        e = { chave: chaveDe(item), item, grupo, eCorpo, atual: alvo.clone(), hover: 0, inicioQueda: agora + novos++ * 110, queda: true };
        grupo.position.copy(e.atual);
        grupo.visible = false;
        grupo.userData.chave = e.chave;
        this.scene.add(grupo);
        this.entradas.set(e.chave, e);
      }
      e.item = item;
      e.alvo = alvo;
    });
  }

  // O item gira e sobe antes de abrir em tela grande
  girar(chave, duracao = 550) {
    const e = this.entradas.get(chave);
    if (!e) return Promise.resolve();
    return new Promise((resolve) => {
      e.giro = { inicio: performance.now(), duracao, resolve };
    });
  }

  quadro() {
    const agora = performance.now();
    const dt = Math.min(this.relogio.getDelta(), 0.05);
    const suave = 1 - Math.exp(-10 * dt);

    this.parallax.lerp(this.ponteiro.x > 5 ? new THREE.Vector2() : this.ponteiro, 0.05);
    this.camera.position.set(this.baseCamera.x + this.parallax.x * 0.7, this.baseCamera.y + this.parallax.y * 0.35, this.baseCamera.z);
    this.camera.lookAt(this.alvoCamera);

    this.entradas.forEach((e, chave) => {
      const g = e.grupo;
      e.atual.lerp(e.alvo || e.atual, suave);
      let y = 0;
      let escala = 1;
      let giro = 0;

      if (e.queda) {
        const t = (agora - e.inicioQueda) / 1000;
        if (t < 0) {
          g.visible = false;
          return;
        }
        g.visible = true;
        const k = Math.min(1, t);
        if (e.eCorpo) {
          escala *= Math.max(0.0001, easeOutBack(k));
        } else {
          y += (1 - easeOutBounce(k)) * 5;
          giro += (1 - k) * 2.2;
        }
        if (k >= 1) e.queda = false;
      }
      e.hover += ((e.passando ? 1 : 0) - e.hover) * suave;
      y += e.hover * 0.1;
      escala += e.hover * 0.05;

      if (e.giro) {
        const t = Math.min(1, (agora - e.giro.inicio) / e.giro.duracao);
        giro += easeInOut(t) * Math.PI * 2;
        y += Math.sin(Math.PI * t) * 0.45;
        escala += Math.sin(Math.PI * t) * 0.35;
        if (t >= 1) {
          e.giro.resolve();
          e.giro = null;
        }
      }
      if (e.saindo) {
        const t = Math.min(1, (agora - e.saindo) / 350);
        escala *= 1 - easeInOut(t);
        if (t >= 1) {
          this.scene.remove(g);
          liberar(g);
          this.entradas.delete(chave);
          return;
        }
      }
      g.position.set(e.atual.x, e.atual.y + y, e.atual.z);
      g.rotation.y = giro;
      g.scale.setScalar(Math.max(escala, 0.0001));
    });

    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- mouse
  itemSob(evento) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
    this.ponteiro.copy(ndc);
    const raio = new THREE.Raycaster();
    raio.setFromCamera(ndc, this.camera);
    const grupos = [...this.entradas.values()].filter((e) => e.grupo.visible && !e.saindo).map((e) => e.grupo);
    const [acerto] = raio.intersectObjects(grupos, true);
    if (!acerto) return null;
    let o = acerto.object;
    while (o && !o.userData.chave) o = o.parent;
    return o ? this.entradas.get(o.userData.chave) : null;
  }

  aoMover(evento) {
    const e = this.itemSob(evento);
    this.entradas.forEach((x) => (x.passando = x === e));
    this.renderer.domElement.style.cursor = e ? 'pointer' : 'default';
    this.aoPassar?.(e ? e.item : null, evento.clientX, evento.clientY);
  }

  sairDoPonteiro() {
    this.ponteiro.set(9, 9);
    this.entradas.forEach((x) => (x.passando = false));
    this.aoPassar?.(null);
  }

  aoSoltar(evento) {
    if (!this.inicio || Math.hypot(evento.clientX - this.inicio.x, evento.clientY - this.inicio.y) > 6) return;
    const e = this.itemSob(evento);
    if (e) this.aoClicar?.(e.item);
  }

  destruir() {
    this.renderer.setAnimationLoop(null);
    this.observador.disconnect();
    this.entradas.forEach((e) => liberar(e.grupo));
    liberar(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
