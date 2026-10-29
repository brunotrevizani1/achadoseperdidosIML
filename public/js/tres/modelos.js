// Modelos 3D dos itens, montados com formas simples e materiais realistas
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as tex from './texturas.js';

const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, metalness: 0, ...o });
const caixa = (w, h, d, m, r = 0.01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), m);
const ouro = () => mat('#e3b341', { metalness: 1, roughness: 0.22 });
const prata = () => mat('#cfd3d8', { metalness: 1, roughness: 0.25 });

// Deixa o modelo com a maior dimensão igual a `alvo`, centrado e apoiado em y = 0
function normalizar(grupo, alvo = 1) {
  const caixaLimite = new THREE.Box3().setFromObject(grupo);
  const tam = caixaLimite.getSize(new THREE.Vector3());
  const escala = alvo / Math.max(tam.x, tam.y, tam.z);
  const centro = caixaLimite.getCenter(new THREE.Vector3());
  const envoltorio = new THREE.Group();
  grupo.position.set(-centro.x, -caixaLimite.min.y, -centro.z);
  const interno = new THREE.Group();
  interno.add(grupo);
  interno.scale.setScalar(escala);
  envoltorio.add(interno);
  envoltorio.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return envoltorio;
}

// ---------------------------------------------------------------------
// Corpos: figura humana com a cor de pele, cabelo e olhos informados na ficha
// ---------------------------------------------------------------------
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escolher = (texto, tabela, padrao) => {
  const t = semAcento(texto);
  const achou = tabela.find(([chave]) => t.includes(chave));
  return achou ? achou[1] : padrao;
};
const COR_PELE = [['branc', '#f0c8a6'], ['negr', '#5b3a29'], ['pret', '#5b3a29'], ['pard', '#a8724c'], ['moren', '#a8724c'],
  ['amarel', '#e4c08a'], ['indigen', '#9b6a47']];
const COR_CABELO = [['loir', '#c8a45a'], ['ruiv', '#8d3b1e'], ['grisalh', '#a7a7a7'], ['branc', '#e4e4e4'], ['castanh', '#4b3324'],
  ['pret', '#1c1613']];
const COR_OLHOS = [['azul', '#5b8fc9'], ['verde', '#5d8a5a'], ['mel', '#a87a3c'], ['cinz', '#8c97a1'], ['castanh', '#4a2f1d'], ['pret', '#1d1512']];
const CAMISAS = ['#3d5a80', '#7a8f6a', '#b5524a', '#d6d0c2', '#2f3340', '#8a6f9e'];
const CALCAS = ['#2b2f3a', '#4a4036', '#35516b'];

// Perfil [raio, altura] -> sólido de revolução (membros, tronco)
function revolucao(perfil, material, segmentos = 24) {
  const pontos = perfil.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(pontos, segmentos), material);
}

function materiaisDaPessoa(item = {}) {
  const base = escolher(item.cor_pele, COR_PELE, '#c68e65');
  const pele = new THREE.MeshPhysicalMaterial({
    color: base, roughness: 0.55, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color(base).offsetHSL(0, 0.1, 0.12),
    clearcoat: 0.08, clearcoatRoughness: 0.6,
  });
  const unha = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(base).lerp(new THREE.Color('#f4dcd0'), 0.6), roughness: 0.25, clearcoat: 0.6 });
  const cabelo = new THREE.MeshStandardMaterial({ color: escolher(item.cor_cabelo, COR_CABELO, '#2a1d16'), roughness: 0.65 });
  const id = Number(item.id) || 0;
  const camisa = new THREE.MeshStandardMaterial({ color: CAMISAS[id % CAMISAS.length], roughness: 0.9 });
  const calca = new THREE.MeshStandardMaterial({ color: CALCAS[id % CALCAS.length], roughness: 0.85 });
  return { pele, unha, cabelo, camisa, calca };
}

const esfera = new THREE.SphereGeometry(1, 28, 20);
const elipsoide = (material, x, y, z, ex, ey, ez) => {
  const o = new THREE.Mesh(esfera, material);
  o.position.set(x, y, z);
  o.scale.set(ex, ey, ez);
  return o;
};

// Pé descalço com calcanhar, dedos, unhas e tornozelo. Origem no chão, dedos para +z.
function criarPe(m, lado) {
  const g = new THREE.Group();
  g.add(elipsoide(m.pele, 0, 0.033, -0.065, 0.034, 0.033, 0.04)); // calcanhar
  g.add(elipsoide(m.pele, 0, 0.034, 0.0, 0.037, 0.03, 0.095)); // arco
  g.add(elipsoide(m.pele, 0, 0.027, 0.09, 0.044, 0.025, 0.065)); // planta da frente
  const dentro = -lado;
  [[0.016, 0.0125, 0.168], [0.0, 0.0088, 0.167], [-0.013, 0.008, 0.16], [-0.025, 0.0073, 0.152], [-0.035, 0.0065, 0.142]].forEach(([dx, r, z]) => {
    const x = dentro * (0.014 + dx);
    g.add(elipsoide(m.pele, x, 0.021, z, r, r * 0.95, r * 1.25));
    g.add(elipsoide(m.unha, x, 0.021 + r * 0.85, z + r * 0.35, r * 0.62, r * 0.2, r * 0.7));
  });
  const tornozelo = revolucao([[0.034, 0.03], [0.031, 0.075], [0.033, 0.13], [0.047, 0.27], [0.056, 0.34], [0.05, 0.46], [0.048, 0.52]], m.pele, 20);
  tornozelo.position.set(0, 0, -0.045);
  g.add(tornozelo);
  [-1, 1].forEach((s) => g.add(elipsoide(m.pele, s * 0.031, 0.06, -0.05, 0.012, 0.017, 0.014))); // ossinhos do tornozelo
  return g;
}

function criarCabeca(m, item) {
  const g = new THREE.Group();
  g.add(elipsoide(m.pele, 0, 0, 0, 0.088, 0.115, 0.1)); // crânio
  g.add(elipsoide(m.pele, 0, -0.06, 0.028, 0.068, 0.07, 0.07)); // maxilar
  const careca = semAcento(item.cor_cabelo).includes('calv') || semAcento(item.cor_cabelo).includes('careca');
  if (!careca) {
    const longo = semAcento(item.cor_cabelo).includes('long') || (item.sexo === 'F' && !semAcento(item.cor_cabelo).includes('curt'));
    const calota = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), m.cabelo);
    calota.scale.set(0.094, 0.122, 0.108);
    calota.rotation.x = -0.28;
    calota.position.set(0, 0.003, -0.004);
    g.add(calota);
    if (longo) g.add(elipsoide(m.cabelo, 0, -0.085, -0.045, 0.098, 0.19, 0.07));
  }
  const olhos = new THREE.MeshStandardMaterial({ color: escolher(item.cor_olhos, COR_OLHOS, '#4a2f1d'), roughness: 0.25 });
  const branco = new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.3 });
  const sobrancelha = new THREE.MeshStandardMaterial({ color: m.cabelo.color.clone().multiplyScalar(0.85), roughness: 0.8 });
  [-1, 1].forEach((s) => {
    g.add(elipsoide(branco, s * 0.035, 0.018, 0.088, 0.0125, 0.0105, 0.01));
    g.add(elipsoide(olhos, s * 0.035, 0.018, 0.097, 0.0068, 0.0068, 0.004));
    g.add(elipsoide(sobrancelha, s * 0.035, 0.042, 0.092, 0.017, 0.0035, 0.006));
    g.add(elipsoide(m.pele, s * 0.093, -0.005, -0.005, 0.01, 0.026, 0.017)); // orelha
  });
  g.add(elipsoide(m.pele, 0, -0.008, 0.1, 0.012, 0.027, 0.016)); // nariz
  g.add(elipsoide(new THREE.MeshStandardMaterial({ color: '#b86b62', roughness: 0.45 }), 0, -0.053, 0.093, 0.022, 0.0065, 0.008)); // boca
  return g;
}

function criarFigura(item) {
  const m = materiaisDaPessoa(item);
  const g = new THREE.Group();
  const mulher = item.sexo === 'F';
  const ombro = mulher ? 0.18 : 0.2;

  [-1, 1].forEach((l) => {
    const pe = criarPe(m, l);
    pe.position.x = l * 0.085;
    pe.rotation.y = l * 0.1;
    g.add(pe);

    // perna da calça: do tornozelo até o quadril, as duas se encontram no meio
    const perna = revolucao([[0.06, 0.14], [0.068, 0.28], [0.066, 0.44], [0.076, 0.58], [0.086, 0.74], [0.09, 0.9]], m.calca, 24);
    perna.position.set(l * 0.08, 0, -0.045);
    g.add(perna);

    // braço: pele do ombro ao punho, manga curta por cima, mão na ponta
    const braco = new THREE.Group();
    braco.add(revolucao([[0.028, -0.62], [0.034, -0.4], [0.042, -0.15], [0.04, 0.03], [0, 0.04]], m.pele, 20));
    braco.add(revolucao([[0.054, -0.2], [0.059, -0.11], [0.057, 0.0], [0.04, 0.05], [0, 0.055]], m.camisa, 20));
    braco.add(elipsoide(m.pele, 0, -0.69, 0, 0.026, 0.06, 0.018));
    braco.add(elipsoide(m.pele, l * -0.025, -0.65, 0.01, 0.011, 0.024, 0.011)); // polegar
    braco.position.set(l * (ombro + 0.035), 1.34, 0);
    braco.rotation.z = l * 0.08;
    g.add(braco);
  });

  // camisa: do quadril aos ombros, numa peça só (sem bolas nos ombros)
  const tronco = revolucao([[0.19, 0.8], [0.185, 0.95], [0.165, 1.1], [0.178, 1.26], [0.2, 1.35], [0.17, 1.41], [0.09, 1.45], [0.052, 1.47]], m.camisa, 32);
  tronco.scale.z = 0.62;
  g.add(tronco);
  g.add(revolucao([[0.047, 1.43], [0.05, 1.5], [0.046, 1.57]], m.pele, 16)); // pescoço
  const cabeca = criarCabeca(m, item);
  cabeca.position.y = 1.67;
  g.add(cabeca);
  return g;
}

const FABRICAS = {
  CELULAR() {
    const g = new THREE.Group();
    const corpo = caixa(0.075, 0.155, 0.009, mat('#15181f', { metalness: 0.7, roughness: 0.28 }), 0.011);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), new THREE.MeshBasicMaterial({ map: tex.telaCelular() }));
    tela.position.z = 0.0048;
    const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 24), mat('#0a0a0d', { metalness: 1, roughness: 0.1 }));
    lente.rotation.x = Math.PI / 2;
    lente.position.set(-0.02, 0.058, -0.0065);
    g.add(corpo, tela, lente);
    g.rotation.x = -0.28; // encostado
    const w = new THREE.Group();
    w.add(g);
    return w;
  },

  DOCUMENTO() {
    const g = new THREE.Group();
    const livro = caixa(0.088, 0.125, 0.008, mat('#ffffff'), 0.003);
    const capa = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.125), new THREE.MeshStandardMaterial({ map: tex.capaDocumento(), roughness: 0.7 }));
    capa.position.z = 0.0041;
    livro.add(capa);
    livro.rotation.x = -0.25;
    livro.position.set(-0.03, 0.06, 0);
    const rg = caixa(0.085, 0.054, 0.0025, mat('#ffffff'), 0.0015);
    const rgFace = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.054), new THREE.MeshStandardMaterial({ map: tex.cartaoIdentidade(), roughness: 0.5 }));
    rgFace.position.z = 0.00135;
    rg.add(rgFace);
    rg.rotation.x = -Math.PI / 2;
    rg.rotation.z = 0.35;
    rg.position.set(0.035, 0.002, 0.045);
    g.add(livro, rg);
    return g;
  },

  ALIANCA() {
    const g = new THREE.Group();
    const almofada = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.014, 32), mat('#7a1f2b', { roughness: 0.95 }));
    almofada.position.y = 0.007;
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.0115, 0.0032, 20, 48), ouro());
    aro.position.set(0, 0.0185, 0);
    aro.rotation.y = 0.5;
    const pedra = new THREE.Mesh(new THREE.OctahedronGeometry(0.0042), new THREE.MeshPhysicalMaterial({
      color: '#bfefff', metalness: 0, roughness: 0.02, transmission: 0.9, thickness: 0.01, ior: 2.1,
    }));
    pedra.position.set(0.0059, 0.0302, -0.0075);
    pedra.rotation.y = 0.5;
    g.add(almofada, aro, pedra);
    return g;
  },

  MOCHILA() {
    const g = new THREE.Group();
    const pano = mat('#2f5d8a', { roughness: 0.92 });
    const corpo = caixa(0.30, 0.42, 0.15, pano, 0.06);
    corpo.position.y = 0.21;
    const bolso = caixa(0.23, 0.15, 0.05, mat('#27507a', { roughness: 0.92 }), 0.03);
    bolso.position.set(0, 0.13, 0.09);
    const ziper = caixa(0.22, 0.008, 0.01, mat('#d8d8d8', { metalness: 0.9, roughness: 0.3 }), 0.003);
    ziper.position.set(0, 0.2, 0.118);
    const alca = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 12, 24, Math.PI), mat('#1d2630', { roughness: 0.8 }));
    alca.position.set(0, 0.42, 0);
    const tira = caixa(0.05, 0.3, 0.02, mat('#1d2630', { roughness: 0.8 }), 0.008);
    tira.position.set(-0.1, 0.2, -0.085);
    const tira2 = tira.clone();
    tira2.position.x = 0.1;
    g.add(corpo, bolso, ziper, alca, tira, tira2);
    return g;
  },

  CARTEIRA() {
    const g = new THREE.Group();
    const couro = mat('#6b3f22', { roughness: 0.55 });
    const base = caixa(0.2, 0.026, 0.11, couro, 0.01);
    base.position.y = 0.013;
    const aba = caixa(0.2, 0.004, 0.05, mat('#5b3419', { roughness: 0.55 }), 0.002);
    aba.position.set(0, 0.028, -0.03);
    const costura = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.0015, 0.002), mat('#d9c18d'));
    costura.position.set(0, 0.0275, 0.05);
    const cartao = caixa(0.085, 0.002, 0.054, mat('#2b6cb0', { roughness: 0.4 }), 0.001);
    cartao.position.set(0.045, 0.027, 0.012);
    cartao.rotation.y = 0.25;
    g.add(base, aba, costura, cartao);
    return g;
  },

  JOIA() {
    const g = new THREE.Group();
    const corrente = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0018, 10, 90), ouro());
    corrente.rotation.x = -Math.PI / 2;
    corrente.scale.y = 1.25;
    corrente.position.y = 0.002;
    const pingente = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), new THREE.MeshPhysicalMaterial({
      color: '#ff5d7d', metalness: 0, roughness: 0.03, transmission: 0.55, thickness: 0.02, ior: 2.2,
    }));
    pingente.scale.set(1, 1.3, 1);
    pingente.position.set(0, 0.014, 0.085);
    const engaste = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.0022, 10, 24), ouro());
    engaste.rotation.x = Math.PI / 2;
    engaste.position.set(0, 0.014, 0.085);
    g.add(corrente, pingente, engaste);
    return g;
  },

  ROUPA() {
    const g = new THREE.Group();
    const calca = caixa(0.30, 0.05, 0.22, mat('#2a3f66', { roughness: 0.95 }), 0.02);
    calca.position.y = 0.025;
    const camisa = caixa(0.27, 0.05, 0.2, mat('#b8c4d6', { roughness: 0.95 }), 0.02);
    camisa.position.set(0.005, 0.073, 0.005);
    camisa.rotation.y = 0.07;
    const gola = caixa(0.1, 0.018, 0.035, mat('#dfe6ef', { roughness: 0.95 }), 0.008);
    gola.position.set(0, 0.105, -0.085);
    const manga = caixa(0.07, 0.03, 0.19, mat('#a9b6ca', { roughness: 0.95 }), 0.012);
    manga.position.set(-0.115, 0.1, 0.01);
    g.add(calca, camisa, gola, manga);
    return g;
  },

  CHAVES() {
    const g = new THREE.Group();
    const argola = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0022, 10, 40), prata());
    argola.rotation.x = Math.PI / 2;
    argola.position.y = 0.0025;
    g.add(argola);
    [-0.5, 0.1, 0.7].forEach((ang, i) => {
      const chave = new THREE.Group();
      const cabeca = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.003, 28), i === 1 ? ouro() : prata());
      const furo = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.0035, 16), mat('#222'));
      const lamina = caixa(0.062, 0.003, 0.0085, i === 1 ? ouro() : prata(), 0.001);
      lamina.position.x = 0.04;
      for (let d = 0; d < 4; d++) {
        const dente = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.004 + (d % 2) * 0.003), i === 1 ? ouro() : prata());
        dente.position.set(0.05 + d * 0.0085, 0, 0.0085);
        chave.add(dente);
      }
      chave.add(cabeca, furo, lamina);
      chave.position.set(0.028, 0.004 + i * 0.0032, 0);
      chave.rotation.y = ang;
      g.add(chave);
    });
    return g;
  },

  OUTRO() {
    const g = new THREE.Group();
    const papelao = mat('#c9a36b', { roughness: 0.95 });
    const caixaG = caixa(0.34, 0.22, 0.24, papelao, 0.006);
    caixaG.position.y = 0.11;
    const fita = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.002, 0.245), mat('#a98046', { roughness: 0.5 }));
    fita.position.y = 0.2215;
    const fitaFrente = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.002), mat('#a98046', { roughness: 0.5 }));
    fitaFrente.position.set(0, 0.12, 0.121);
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ map: tex.cartao('IML', { w: 256, h: 160, borda: '#555' }) }));
    etiqueta.position.set(-0.09, 0.12, 0.1225);
    g.add(caixaG, fita, fitaFrente, etiqueta);
    return g;
  },

  // Corpos: figura humana inteira (só aparece no visualizador)
  PESSOA(item) {
    return criarFigura(item);
  },
};

// Os pés e as pernas que aparecem sob a cortina, com a etiqueta do código no chão
export function criarPes(item) {
  const m = materiaisDaPessoa(item);
  const g = new THREE.Group();
  [-1, 1].forEach((l) => {
    const pe = criarPe(m, l);
    pe.position.x = l * 0.1;
    pe.rotation.y = l * 0.14;
    g.add(pe);
  });
  const etiqueta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.1),
    new THREE.MeshStandardMaterial({ map: tex.cartao(item.codigo || 'IML', { w: 512, h: 256, rotulo: '' }), roughness: 0.85 })
  );
  etiqueta.rotation.x = -Math.PI / 2;
  etiqueta.rotation.z = 0.2;
  etiqueta.position.set(0.04, 0.003, 0.3);
  g.add(etiqueta);
  g.scale.setScalar(1.7); // proporcional aos objetos, que também são ampliados
  const caixaToque = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.45), new THREE.MeshBasicMaterial({ visible: false }));
  caixaToque.position.set(0, 0.25, 0.1);
  g.add(caixaToque);
  g.traverse((o) => {
    if (o.isMesh && o !== caixaToque) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

// tipo: categoria do objeto, ou 'PESSOA' para corpos
export function criarModelo(tipo, item, alvo = 1) {
  const fabrica = FABRICAS[tipo] || FABRICAS.OUTRO;
  return normalizar(fabrica(item), alvo);
}
