// Modelos 3D dos itens, montados com formas simples e materiais realistas
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as tex from './texturas.js';

const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, metalness: 0, ...o });
const caixa = (w, h, d, m, r = 0.01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m);
const ouro = () => mat('#e3b341', { metalness: 1, roughness: 0.22 });
const prata = () => mat('#cfd3d8', { metalness: 1, roughness: 0.25 });

// Junta numa só malha tudo o que usa o mesmo material: o modelo fica igual, mas a GPU recebe bem menos chamadas de desenho
export function fundir(raiz) {
  raiz.updateWorldMatrix(true, true);
  const inversa = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const porMaterial = new Map();
  raiz.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.material.visible === false) return;
    if (!porMaterial.has(o.material)) porMaterial.set(o.material, []);
    porMaterial.get(o.material).push(o);
  });
  porMaterial.forEach((malhas, material) => {
    if (malhas.length < 2) return;
    try {
      let partes = malhas.map((o) => o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inversa, o.matrixWorld)));
      const indexadas = partes.filter((p) => p.index).length;
      if (indexadas && indexadas < partes.length) partes = partes.map((p) => (p.index ? p.toNonIndexed() : p)); // todas iguais, senão não junta
      const junto = mergeGeometries(partes, false);
      partes.forEach((p) => p.dispose());
      if (!junto) return;
      const fundida = new THREE.Mesh(junto, material);
      fundida.castShadow = malhas[0].castShadow;
      fundida.receiveShadow = malhas[0].receiveShadow;
      fundida.userData.semSombra = malhas[0].userData.semSombra;
      raiz.add(fundida);
      malhas.forEach((o) => o.removeFromParent());
    } catch {
      /* geometrias incompatíveis: ficam separadas */
    }
  });
}

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
  fundir(envoltorio);
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

// Perfil [raio, altura] -> sólido de revolução (membros, tronco)
function revolucao(perfil, material, segmentos = 24) {
  const pontos = perfil.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(pontos, segmentos), material);
}

function materiaisDaPessoa(item = {}) {
  const base = escolher(item.cor_pele, COR_PELE, '#c68e65');
  const pele = new THREE.MeshPhysicalMaterial({
    color: base, roughness: 0.55, sheen: 0.2, sheenRoughness: 0.5, sheenColor: new THREE.Color(base).offsetHSL(0, 0.1, 0.06),
    clearcoat: 0.08, clearcoatRoughness: 0.6,
  });
  const unha = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(base).lerp(new THREE.Color('#f4dcd0'), 0.6), roughness: 0.25, clearcoat: 0.6 });
  const cabelo = new THREE.MeshStandardMaterial({ color: escolher(item.cor_cabelo, COR_CABELO, '#2a1d16'), roughness: 0.65 });
  return { pele, unha, cabelo };
}

const esfera = new THREE.SphereGeometry(1, 28, 20);
const esferaLeve = new THREE.SphereGeometry(1, 12, 8); // para detalhes pequenos (dedos, unhas): muito menos triângulos
const elipsoide = (material, x, y, z, ex, ey, ez, leve = false) => {
  const o = new THREE.Mesh(leve ? esferaLeve : esfera, material);
  o.position.set(x, y, z);
  o.scale.set(ex, ey, ez);
  return o;
};

// Pé descalço com calcanhar, dedos, unhas e tornozelo. Origem no chão, dedos para +z.
function criarPe(m, lado, comTornozelo = true, leve = false) {
  const g = new THREE.Group();
  const ell = (...a) => elipsoide(...a, leve);
  g.add(ell(m.pele, 0, 0.033, -0.065, 0.034, 0.033, 0.04)); // calcanhar
  g.add(ell(m.pele, 0, 0.034, 0.0, 0.037, 0.03, 0.095)); // arco
  g.add(ell(m.pele, 0, 0.027, 0.09, 0.044, 0.025, 0.065)); // planta da frente
  const dentro = -lado;
  [[0.016, 0.0125, 0.168], [0.0, 0.0088, 0.167], [-0.013, 0.008, 0.16], [-0.025, 0.0073, 0.152], [-0.035, 0.0065, 0.142]].forEach(([dx, r, z]) => {
    const x = dentro * (0.014 + dx);
    g.add(ell(m.pele, x, 0.021, z, r, r * 0.95, r * 1.25));
    g.add(ell(m.unha, x, 0.021 + r * 0.85, z + r * 0.35, r * 0.62, r * 0.2, r * 0.7));
  });
  if (comTornozelo) {
    const tornozelo = revolucao([[0.034, 0.03], [0.031, 0.075], [0.033, 0.13], [0.047, 0.27], [0.056, 0.34], [0.05, 0.46], [0.048, 0.52]], m.pele, leve ? 10 : 20);
    tornozelo.position.set(0, 0, -0.045);
    g.add(tornozelo);
  }
  [-1, 1].forEach((s) => g.add(ell(m.pele, s * 0.031, 0.06, -0.05, 0.012, 0.017, 0.014))); // ossinhos do tornozelo
  fundir(g);
  return g;
}

function criarCabeca(m, item) {
  const g = new THREE.Group();
  g.add(elipsoide(m.pele, 0, 0, 0, 0.088, 0.115, 0.1)); // crânio
  g.add(elipsoide(m.pele, 0, -0.052, 0.016, 0.066, 0.064, 0.068)); // maxilar
  g.add(elipsoide(m.pele, 0, -0.088, 0.046, 0.026, 0.017, 0.022)); // queixo
  const cor = semAcento(item.cor_cabelo);
  if (!cor.includes('calv') && !cor.includes('careca')) {
    const longo = cor.includes('long') || (item.sexo === 'F' && !cor.includes('curt'));
    const calota = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.47), m.cabelo);
    calota.scale.set(0.098, 0.126, 0.112);
    calota.rotation.x = -0.38;
    calota.position.set(0, 0.003, -0.004);
    g.add(calota);
    g.add(elipsoide(m.cabelo, 0, 0.07, -0.01, 0.09, 0.06, 0.098)); // volume no topo
    const franja = elipsoide(m.cabelo, 0, 0.082, 0.062, 0.078, 0.03, 0.05);
    franja.rotation.x = 0.55;
    g.add(franja);
    [-1, 1].forEach((s) => g.add(elipsoide(m.cabelo, s * 0.086, 0.01, -0.005, 0.011, 0.036, 0.03))); // costeletas
    if (longo) g.add(elipsoide(m.cabelo, 0, -0.085, -0.045, 0.098, 0.19, 0.07));
  }
  const olhos = new THREE.MeshStandardMaterial({ color: escolher(item.cor_olhos, COR_OLHOS, '#4a2f1d'), roughness: 0.25 });
  const branco = new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.3 });
  const sobrancelha = new THREE.MeshStandardMaterial({ color: m.cabelo.color.clone().multiplyScalar(0.8), roughness: 0.8 });
  const labio = new THREE.MeshStandardMaterial({ color: new THREE.Color(m.pele.color).lerp(new THREE.Color('#9a4a48'), 0.45), roughness: 0.4 });
  [-1, 1].forEach((s) => {
    g.add(elipsoide(branco, s * 0.035, 0.018, 0.088, 0.0145, 0.0125, 0.011));
    g.add(elipsoide(olhos, s * 0.035, 0.018, 0.0975, 0.0085, 0.0085, 0.004));
    g.add(elipsoide(m.pele, s * 0.035, 0.03, 0.091, 0.0165, 0.0075, 0.0105)); // pálpebra
    g.add(elipsoide(sobrancelha, s * 0.036, 0.046, 0.092, 0.021, 0.0045, 0.007));
    g.add(elipsoide(m.pele, s * 0.092, -0.005, -0.005, 0.012, 0.03, 0.02)); // orelha
  });
  g.add(elipsoide(m.pele, 0, 0.0, 0.095, 0.008, 0.024, 0.01)); // ponte do nariz
  g.add(elipsoide(m.pele, 0, -0.022, 0.1, 0.011, 0.01, 0.01)); // ponta do nariz
  g.add(elipsoide(labio, 0, -0.05, 0.095, 0.022, 0.0045, 0.008)); // lábio superior
  g.add(elipsoide(labio, 0, -0.059, 0.093, 0.019, 0.0055, 0.008)); // lábio inferior
  return g;
}

const capsula = (material, raio, comprimento, x, y, z) => {
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(raio, comprimento, 8, 20), material);
  o.position.set(x, y, z);
  return o;
};

// Sólido por seções: cada seção é uma elipse { y, rx, rz, cx, cz } e a malha passa suavemente por todas.
// Serve para tronco, pernas, braços e pescoço, com curvas de verdade (ombro, cintura, panturrilha).
function loft(secoes, material, { seg = 40, linhas = 44, ruga = 0, tampas = true, uv = false, delta = 0, desde = null, ate = null } = {}) {
  const forma = new THREE.CatmullRomCurve3(secoes.map((s) => new THREE.Vector3(s.rx, s.y, s.rz)), false, 'catmullrom', 0.5);
  const centro = new THREE.CatmullRomCurve3(secoes.map((s) => new THREE.Vector3(s.cx || 0, 0, s.cz || 0)), false, 'catmullrom', 0.5);
  // desde/ate (alturas y) recortam só um trecho do mesmo perfil; delta engrossa a casca (usado nas tatuagens)
  const acharT = (y) => {
    let a = 0;
    let b = 1;
    for (let k = 0; k < 30; k++) {
      const meio = (a + b) / 2;
      if (forma.getPoint(meio).y < y) a = meio;
      else b = meio;
    }
    return (a + b) / 2;
  };
  const t0 = desde === null ? 0 : acharT(desde);
  const t1 = ate === null ? 1 : acharT(ate);
  const pos = [];
  const coords = [];
  const colunas = uv ? seg + 1 : seg; // com UV a costura é duplicada, para a textura não esticar
  for (let i = 0; i < linhas; i++) {
    const passo = i / (linhas - 1);
    const t = t0 + (t1 - t0) * passo;
    const f = forma.getPoint(t);
    const c = centro.getPoint(t);
    for (let j = 0; j < colunas; j++) {
      if (uv) coords.push(j / seg, passo);
      const a = (j / seg) * Math.PI * 2;
      const dobra = 1 + ruga * Math.sin(t * 38 + Math.sin(a * 2) * 2.2) * Math.sin(a * 3 + t * 5);
      pos.push(c.x + (f.x + delta) * dobra * Math.sin(a), f.y, c.z + (f.z + delta) * dobra * Math.cos(a));
    }
  }
  const idx = [];
  for (let i = 0; i < linhas - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * colunas + j;
      const b = uv ? a + 1 : i * seg + ((j + 1) % seg);
      idx.push(a, a + colunas, b, b, a + colunas, b + colunas);
    }
  }
  if (tampas) [[0, secoes[0], false], [(linhas - 1) * seg, secoes[secoes.length - 1], true]].forEach(([base, s, topo]) => {
    const c = pos.length / 3;
    pos.push(s.cx || 0, s.y, s.cz || 0);
    for (let j = 0; j < seg; j++) {
      const b = base + ((j + 1) % seg);
      idx.push(c, ...(topo ? [base + j, b] : [b, base + j]));
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // as faces precisam olhar para fora: se a normal do meio da lateral aponta para dentro, inverte
  const meio = Math.floor(linhas / 2) * colunas;
  if (geo.attributes.normal.getZ(meio) < 0) {
    const inv = geo.index.array;
    for (let k = 0; k < inv.length; k += 3) [inv[k + 1], inv[k + 2]] = [inv[k + 2], inv[k + 1]];
    geo.computeVertexNormals();
  }
  return new THREE.Mesh(geo, material);
}

// Mão com palma, quatro dedos levemente curvados e polegar
function criarMao(m, lado) {
  const g = new THREE.Group();
  g.add(elipsoide(m.pele, 0, 0, 0, 0.03, 0.045, 0.017)); // palma
  [-0.019, -0.0065, 0.0065, 0.019].forEach((x, k) => {
    const dedo = capsula(m.pele, 0.0072, 0.04 - Math.abs(k - 1.5) * 0.004, x, -0.066, 0.004);
    dedo.rotation.x = 0.12 + (k % 2) * 0.04;
    g.add(dedo);
  });
  const polegar = capsula(m.pele, 0.0085, 0.03, lado * -0.03, -0.02, 0.012);
  polegar.rotation.z = lado * 0.5;
  g.add(polegar);
  fundir(g);
  return g;
}

// Perfis do corpo (seções de baixo para cima). A pele e a tatuagem usam o mesmo perfil, a tatuagem 4 mm por fora.
const SEC_BRACO = [
  { y: -0.62, rx: 0.027, rz: 0.022 }, { y: -0.5, rx: 0.035, rz: 0.032 }, { y: -0.34, rx: 0.041, rz: 0.04 },
  { y: -0.18, rx: 0.046, rz: 0.048 }, { y: -0.04, rx: 0.052, rz: 0.054 }, { y: 0.04, rx: 0.05, rz: 0.054 },
  { y: 0.075, rx: 0.032, rz: 0.036 },
];
const secPerna = (q) => [
  { y: 0.06, rx: 0.031, rz: 0.036 }, { y: 0.14, rx: 0.036, rz: 0.04 }, { y: 0.3, rx: 0.052, rz: 0.056, cz: -0.008 },
  { y: 0.5, rx: 0.05, rz: 0.052 }, { y: 0.72, rx: 0.082, rz: 0.086, cz: -0.004 },
  { y: 0.88, rx: 0.091 * q, rz: 0.094 }, { y: 0.97, rx: 0.08 * q, rz: 0.085 },
];
const secTronco = (ombros, cintura, quadril) => [
  { y: 0.8, rx: 0.165 * quadril, rz: 0.1, cz: -0.01 }, { y: 0.92, rx: 0.178 * quadril, rz: 0.104, cz: -0.01 },
  { y: 1.05, rx: 0.16 * cintura, rz: 0.098, cz: -0.01 }, { y: 1.15, rx: 0.148 * cintura, rz: 0.09, cz: -0.01 },
  { y: 1.27, rx: 0.16 * cintura, rz: 0.098, cz: -0.008 }, { y: 1.38, rx: 0.178 * ombros, rz: 0.104, cz: -0.004 },
  { y: 1.46, rx: 0.185 * ombros, rz: 0.09, cz: -0.012 }, { y: 1.52, rx: 0.13 * ombros, rz: 0.075, cz: -0.014 },
  { y: 1.56, rx: 0.07, rz: 0.058, cz: -0.012 }, { y: 1.6, rx: 0.052, rz: 0.052, cz: -0.006 },
];
const SEC_PESCOCO = [{ y: 1.55, rx: 0.05, rz: 0.052, cz: -0.004 }, { y: 1.64, rx: 0.046, rz: 0.049, cz: 0.004 }, { y: 1.72, rx: 0.047, rz: 0.05, cz: 0.012 }];

// "BRACO_D:FLORAL,PEITO:CHAMAS" -> Map(local -> estilo); sem estilo, vale o tribal
const tatuagensDe = (valor) => new Map(String(valor || '').split(',').filter(Boolean).map((tok) => {
  const [local, estilo] = tok.split(':');
  return [local, estilo || 'TRIBAL'];
}));

// Corpo inteiro (pés no chão, dedos para +z): manequim liso, sem detalhes anatômicos, com um lençol
// enrolado cobrindo a parte íntima (cintura às coxas; no corpo feminino, também o busto)
function criarFigura(item) {
  const m = materiaisDaPessoa(item);
  const g = new THREE.Group();
  const mulher = item.sexo === 'F';
  const ombros = mulher ? 0.9 : 1;
  const cintura = mulher ? 0.9 : 1;
  const quadril = mulher ? 1.06 : 1;
  const lencol = new THREE.MeshStandardMaterial({ color: '#eef1f2', roughness: 0.95, side: THREE.DoubleSide });
  const tatuagens = tatuagensDe(item.tatuagens);
  // casca de tinta sobre o mesmo perfil; `repeticoes` repete o desenho ao longo do comprimento
  const tatuar = (local, secoes, trecho, opcoes = {}) => {
    if (!tatuagens.has(local)) return null;
    const { faixa = null, repeticoes = 1, seg = 40 } = opcoes;
    const mapa = tex.tatuagem(tatuagens.get(local), faixa ? { centro: faixa[0], largura: faixa[1] } : {});
    mapa.repeat.set(1, repeticoes);
    const tinta = new THREE.MeshStandardMaterial({
      map: mapa, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    return loft(secoes, tinta, { seg, linhas: 36, tampas: false, uv: true, delta: 0.004, desde: trecho[0], ate: trecho[1] });
  };

  [-1, 1].forEach((l) => {
    const pe = criarPe(m, l, false);
    pe.position.x = l * 0.09;
    pe.rotation.y = l * 0.12;
    g.add(pe);

    // perna: tornozelo, panturrilha, joelho, coxa e quadril
    const perna = loft(secPerna(quadril), m.pele, { seg: 28, linhas: 40 });
    perna.position.x = l * 0.09;
    g.add(perna);

    // braço inteiro de pele, com a mão na ponta
    const braco = new THREE.Group();
    braco.position.set(l * 0.17 * ombros, 1.43, 0);
    braco.rotation.set(-0.04, 0, l * 0.07);
    braco.add(loft(SEC_BRACO, m.pele, { seg: 24, linhas: 28 }));
    const mao = criarMao(m, l);
    mao.position.set(0, -0.665, 0.002);
    braco.add(mao);

    // tatuagem no membro todo; a direita da pessoa fica do lado -x (ela olha para +z)
    const lado = l < 0 ? 'D' : 'E';
    const noBraco = tatuar(`BRACO_${lado}`, SEC_BRACO, [-0.6, 0.04], { repeticoes: 2, seg: 28 });
    if (noBraco) braco.add(noBraco);
    const naPerna = tatuar(`PERNA_${lado}`, secPerna(quadril), [0.07, 0.69], { repeticoes: 3, seg: 28 }); // para onde começa o lençol
    if (naPerna) {
      naPerna.position.x = l * 0.09;
      g.add(naPerna);
    }
    g.add(braco);
  });

  // tronco liso, do quadril aos ombros, com a inclinação do trapézio até o pescoço
  const sTronco = secTronco(ombros, cintura, quadril);
  g.add(loft(sTronco, m.pele));
  [
    ['PEITO', [1.2, 1.46], [0, 0.62]],
    ['ABDOME', [1.08, 1.24], [0, 0.62]],
    ['COSTAS', [1.08, 1.46], [0.5, 0.62]],
  ].forEach(([local, trecho, faixa]) => {
    if (mulher) return; // no corpo feminino o lençol cobre o tronco: a tinta apareceria por cima dele
    const tinta = tatuar(local, sTronco, trecho, { faixa, repeticoes: 1 });
    if (tinta) g.add(tinta);
  });
  g.add(loft(SEC_PESCOCO, m.pele, { seg: 24, linhas: 12 }));
  const noPescoco = tatuar('PESCOCO', SEC_PESCOCO, [1.58, 1.68], { seg: 24 });
  if (noPescoco) g.add(noPescoco);

  // lençol enrolado: sobe até a cintura (ou até o busto) e desce até o meio das coxas
  const topo = mulher
    ? [{ y: 1.44, rx: 0.168 * ombros, rz: 0.112, cz: -0.006 }, { y: 1.3, rx: 0.17 * cintura, rz: 0.112, cz: -0.006 }, { y: 1.15, rx: 0.158 * cintura, rz: 0.108, cz: -0.008 }]
    : [{ y: 1.08, rx: 0.172, rz: 0.108, cz: -0.008 }];
  g.add(loft(
    [...topo, { y: 1.0, rx: 0.19 * quadril, rz: 0.122, cz: -0.004 }, { y: 0.86, rx: 0.2 * quadril, rz: 0.13, cz: -0.002 }, { y: 0.7, rx: 0.205 * quadril, rz: 0.132, cz: -0.002 }],
    lencol, { tampas: false, ruga: 0.03 }
  ));
  const dobra = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 10, 40), lencol); // borda enrolada na cintura
  dobra.rotation.x = Math.PI / 2;
  dobra.scale.set(mulher ? 1.12 : 1.18, 0.74, 1);
  dobra.position.set(0, mulher ? 1.43 : 1.07, -0.008);
  g.add(dobra);

  const cabeca = criarCabeca(m, item);
  cabeca.scale.setScalar(1.05);
  cabeca.position.set(0, 1.775, 0.012);
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

  OCULOS() {
    const g = new THREE.Group();
    const armacao = mat('#17191d', { roughness: 0.35, metalness: 0.3 });
    const lente = new THREE.MeshPhysicalMaterial({ color: '#a8cdd9', roughness: 0.05, transparent: true, opacity: 0.38 });
    [-1, 1].forEach((s) => {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0034, 12, 40), armacao);
      aro.scale.x = 1.18;
      aro.position.set(s * 0.037, 0.03, 0);
      const vidro = new THREE.Mesh(new THREE.CircleGeometry(0.0258, 32), lente);
      vidro.scale.x = 1.18;
      vidro.position.set(s * 0.037, 0.03, 0);
      g.add(aro, vidro);
    });
    const ponte = new THREE.Mesh(new THREE.TorusGeometry(0.0065, 0.0028, 8, 16, Math.PI), armacao);
    ponte.position.set(0, 0.034, 0);
    g.add(ponte);
    [0.047, 0.016].forEach((y) => { // hastes dobradas atrás das lentes
      const haste = caixa(0.118, 0.0042, 0.0032, armacao, 0.001);
      haste.position.set(0, y, -0.012);
      g.add(haste);
    });
    g.rotation.x = -0.28;
    const w = new THREE.Group();
    w.add(g);
    return w;
  },

  RELOGIO() {
    const g = new THREE.Group();
    const couro = new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.8, side: THREE.DoubleSide });
    const pulseira = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 40, 1, true), couro);
    pulseira.rotation.x = Math.PI / 2;
    pulseira.position.y = 0.03;
    const cx = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.011, 40), prata());
    cx.position.y = 0.0635;
    const mostrador = new THREE.Mesh(new THREE.CircleGeometry(0.0185, 40), new THREE.MeshStandardMaterial({ map: tex.relogio(), roughness: 0.4 }));
    mostrador.rotation.x = -Math.PI / 2;
    mostrador.position.y = 0.0692;
    const vidro = new THREE.Mesh(new THREE.CircleGeometry(0.0195, 40), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.02 }));
    vidro.rotation.x = -Math.PI / 2;
    vidro.position.y = 0.0698;
    const coroa = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.007, 12), prata());
    coroa.rotation.z = Math.PI / 2;
    coroa.position.set(0.0245, 0.0635, 0);
    g.add(pulseira, cx, mostrador, vidro, coroa);
    g.rotation.x = 0.55;
    const w = new THREE.Group();
    w.add(g);
    return w;
  },

  CALCADO() {
    const g = new THREE.Group();
    const branco = mat('#f4f4f1', { roughness: 0.7 });
    const solaMat = mat('#b9b7ae', { roughness: 0.8 });
    const detalhe = mat('#2f5d8a', { roughness: 0.7 });
    const sola = caixa(0.108, 0.03, 0.27, solaMat, 0.012);
    sola.position.set(0, 0.015, 0.065);
    const corpo = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), branco);
    corpo.scale.set(0.054, 0.05, 0.145);
    corpo.position.set(0, 0.066, 0.058);
    const cano = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), branco);
    cano.scale.set(0.047, 0.05, 0.058);
    cano.position.set(0, 0.095, -0.052);
    const biqueira = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), detalhe);
    biqueira.scale.set(0.05, 0.034, 0.05);
    biqueira.position.set(0, 0.05, 0.168);
    g.add(sola, corpo, cano, biqueira);
    [-1, 1].forEach((s) => { // faixas laterais
      const faixa = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), detalhe);
      faixa.scale.set(0.004, 0.014, 0.05);
      faixa.position.set(s * 0.0525, 0.066, 0.03);
      faixa.rotation.x = -0.25;
      g.add(faixa);
    });
    for (let i = 0; i < 4; i++) { // cadarço
      const laco = caixa(0.052, 0.005, 0.01, detalhe, 0.002);
      laco.position.set(0, 0.114 - i * 0.003, 0.045 + i * 0.024);
      laco.rotation.x = -0.4;
      g.add(laco);
    }
    g.rotation.y = -0.9;
    return g;
  },

  BONE() {
    const g = new THREE.Group();
    const pano = new THREE.MeshStandardMaterial({ color: '#c0272d', roughness: 0.85, side: THREE.DoubleSide });
    const cupula = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), pano);
    cupula.scale.set(0.095, 0.085, 0.105);
    const aba = new THREE.Mesh(new THREE.CircleGeometry(1, 40, Math.PI, Math.PI), pano);
    aba.scale.set(0.1, 0.092, 1);
    aba.rotation.x = -Math.PI / 2 + 0.2;
    aba.position.set(0, 0.006, 0.085);
    const botao = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), pano);
    botao.position.y = 0.085;
    const emblema = new THREE.Mesh(new THREE.CircleGeometry(0.02, 28), new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.6 }));
    emblema.position.set(0, 0.04, 0.104);
    emblema.rotation.x = -0.35;
    g.add(cupula, aba, botao, emblema);
    return g;
  },

  FONE() {
    const g = new THREE.Group();
    const preto = mat('#1b1d21', { roughness: 0.45, metalness: 0.2 });
    const almofada = mat('#2d3035', { roughness: 0.95 });
    const banda = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.0075, 12, 48, Math.PI), preto);
    banda.position.y = 0.036;
    g.add(banda);
    [-1, 1].forEach((s) => {
      const copo = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.026, 32), preto);
      copo.rotation.z = Math.PI / 2;
      copo.position.set(s * 0.075, 0.037, 0);
      const pad = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.01, 10, 28), almofada);
      pad.rotation.y = Math.PI / 2;
      pad.position.set(s * 0.06, 0.037, 0);
      g.add(copo, pad);
    });
    return g;
  },

  GUARDA_CHUVA() {
    const g = new THREE.Group();
    const azul = new THREE.MeshStandardMaterial({ color: '#1f2a44', roughness: 0.8 });
    const madeira = mat('#4a2f1d', { roughness: 0.55 });
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.82, 12), prata());
    haste.position.y = 0.45;
    const copa = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.44, 24), azul);
    copa.position.y = 0.62;
    const prega = new THREE.Mesh(new THREE.TorusGeometry(0.0515, 0.0065, 10, 28), mat('#0f1524', { roughness: 0.6 }));
    prega.rotation.x = Math.PI / 2;
    prega.position.y = 0.5;
    const cabo = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 12, 24, Math.PI), madeira);
    cabo.rotation.z = Math.PI;
    cabo.position.set(-0.036, 0.046, 0);
    const empunhadura = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.1, 14), madeira);
    empunhadura.position.set(0, 0.095, 0);
    g.add(haste, copa, prega, cabo, empunhadura);
    g.rotation.z = 0.12;
    g.rotation.y = 0.3;
    return g;
  },

  BOLSA() {
    const g = new THREE.Group();
    const couro = mat('#6d1f2b', { roughness: 0.5 });
    const escuro = mat('#591924', { roughness: 0.5 });
    const corpo = caixa(0.3, 0.2, 0.11, couro, 0.035);
    corpo.position.y = 0.1;
    const aba = caixa(0.304, 0.085, 0.116, escuro, 0.03);
    aba.position.y = 0.158;
    const fecho = caixa(0.04, 0.026, 0.01, ouro(), 0.004);
    fecho.position.set(0, 0.135, 0.062);
    [-0.03, 0.03].forEach((z) => {
      const alca = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.0085, 10, 32, Math.PI), couro);
      alca.position.set(0, 0.2, z);
      g.add(alca);
    });
    g.add(corpo, aba, fecho);
    return g;
  },

  NOTEBOOK() {
    const g = new THREE.Group();
    const metal = mat('#a9afb6', { metalness: 0.85, roughness: 0.35 });
    const base = caixa(0.34, 0.014, 0.23, metal, 0.004);
    base.position.y = 0.007;
    const teclas = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.165), new THREE.MeshStandardMaterial({ map: tex.teclado(), roughness: 0.6 }));
    teclas.rotation.x = -Math.PI / 2;
    teclas.position.set(0, 0.0145, -0.01);
    const tela = new THREE.Group();
    tela.position.set(0, 0.014, -0.112);
    const tampa = caixa(0.34, 0.22, 0.008, metal, 0.004);
    tampa.position.y = 0.11;
    const imagem = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshBasicMaterial({ map: tex.telaNotebook() }));
    imagem.position.set(0, 0.11, 0.0045);
    tela.add(tampa, imagem);
    tela.rotation.x = -0.35;
    g.add(base, teclas, tela);
    g.rotation.y = -0.4;
    return g;
  },

  // Corpos: figura humana inteira (só aparece no visualizador)
  PESSOA(item) {
    return criarFigura(item);
  },
};

// Gaveta da câmara fria: bandeja de inox saindo da parede, corpo coberto por um lençol e
// só os pés à mostra, com a etiqueta de identificação no dedo. Origem na frente da câmara
// (y = topo da bandeja); a gaveta sai para +z e os pés ficam voltados para quem olha.
export const ALCANCE_GAVETA = 0.8;
export const ESCALA_GAVETA = 1.3;

export function criarGaveta(item) {
  const m = materiaisDaPessoa(item);
  const g = new THREE.Group();
  const comp = ALCANCE_GAVETA;
  const aco = new THREE.MeshStandardMaterial({ color: '#c3ccd1', metalness: 0.9, roughness: 0.3 });

  const bandeja = caixa(0.62, 0.04, comp, aco, 0.008);
  bandeja.position.set(0, -0.02, comp / 2);
  g.add(bandeja);
  [-1, 1].forEach((l) => {
    const borda = caixa(0.025, 0.05, comp, aco, 0.006);
    borda.position.set(l * 0.3225, 0.005, comp / 2);
    g.add(borda);
  });

  // Lençol: duas pernas sob o tecido, que cai pelas laterais da bandeja
  const fimLencol = comp - 0.06;
  const lencolGeo = new THREE.PlaneGeometry(0.76, fimLencol, 24, 30);
  lencolGeo.rotateX(-Math.PI / 2);
  lencolGeo.translate(0, 0, fimLencol / 2);
  const pos = lencolGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const t = z / fimLencol; // 0 na câmara, 1 nos pés
    const alto = 0.145 - 0.06 * t;
    const larg = 0.105 - 0.035 * t;
    const perna = [-1, 1].reduce((mx, l) => {
      const u = (x - l * 0.095) / larg;
      return Math.max(mx, alto * Math.max(0, 1 - u * u) ** 0.6);
    }, 0);
    const caida = Math.max(0, Math.abs(x) - 0.31) * 2.4;
    pos.setY(i, 0.012 + perna + 0.005 * Math.sin(z * 38 + x * 21) - caida);
  }
  lencolGeo.computeVertexNormals();
  g.add(new THREE.Mesh(lencolGeo, new THREE.MeshStandardMaterial({ color: '#f1f4f5', roughness: 0.95, side: THREE.DoubleSide })));

  // Pés deitados: sola voltada para a frente, dedos para cima
  [-1, 1].forEach((l) => {
    const pe = criarPe(m, l, true, true);
    pe.traverse((o) => (o.userData.semSombra = true)); // os pés são pequenos: não vale gastar sombra neles
    pe.rotation.set(-Math.PI / 2, l * 0.12, 0);
    pe.position.set(l * 0.095, 0.1, comp);
    g.add(pe);
  });

  // Etiqueta amarrada no dedão do pé esquerdo
  const barbante = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 6), mat('#8a6d1f'));
  barbante.position.set(-0.065, 0.245, comp + 0.004);
  barbante.rotation.x = 0.2;
  const etiqueta = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.075),
    new THREE.MeshStandardMaterial({ map: tex.etiquetaDedo(item.codigo || 'IML'), roughness: 0.8, side: THREE.DoubleSide })
  );
  etiqueta.position.set(-0.04, 0.19, comp + 0.014);
  etiqueta.rotation.set(0.12, -0.15, 0.05);
  g.add(barbante, etiqueta);

  const caixaToque = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, comp + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  caixaToque.position.set(0, 0.2, comp / 2);
  g.add(caixaToque);
  g.traverse((o) => {
    if (o.isMesh && o !== caixaToque) {
      o.castShadow = !o.userData.semSombra;
      o.receiveShadow = !o.userData.semSombra;
    }
  });
  fundir(g);
  g.scale.setScalar(ESCALA_GAVETA);
  return g;
}

// tipo: categoria do objeto, ou 'PESSOA' para corpos
export function criarModelo(tipo, item, alvo = 1) {
  const fabrica = FABRICAS[tipo] || FABRICAS.OUTRO;
  return normalizar(fabrica(item), alvo);
}
