// Móveis e enfeites dos cenários (recepção e sala do administrador): só formas simples e de poucos triângulos
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as tex from './texturas.js';
import { fundir } from './modelos.js';

const mat = (cor, o = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, ...o });
const caixa = (w, h, d, m, r = 0.01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m);
const cilindro = (rt, rb, h, m, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const inox = () => mat('#c3ccd1', { metalness: 0.9, roughness: 0.3 });

function sombras(grupo, projeta = true) {
  grupo.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = projeta;
      o.receiveShadow = true;
    }
  });
  return grupo;
}

// Vaso com planta de folhas compridas
export function criarPlanta(escala = 1) {
  const g = new THREE.Group();
  const vaso = cilindro(0.2, 0.14, 0.34, mat('#b5654a', { roughness: 0.8 }), 16);
  vaso.position.y = 0.17;
  const terra = cilindro(0.185, 0.185, 0.02, mat('#3b2a1e', { roughness: 1 }), 16);
  terra.position.y = 0.335;
  g.add(vaso, terra);
  const verdes = ['#2f7a45', '#3a8f52', '#2a6b3d', '#4a9a5c'].map((c) => mat(c, { roughness: 0.6 })); // compartilhados: viram uma malha só
  const folha = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.3;
    const incl = 0.35 + (i % 3) * 0.22;
    const comp = 0.34 + (i % 4) * 0.07;
    const f = new THREE.Mesh(folha, verdes[i % 4]);
    f.scale.set(0.05, comp, 0.012);
    f.position.set(Math.sin(a) * incl * 0.28, 0.34 + comp * 0.8, Math.cos(a) * incl * 0.28);
    f.rotation.set(Math.cos(a) * incl, 0, -Math.sin(a) * incl);
    g.add(f);
  }
  sombras(g);
  fundir(g);
  g.scale.setScalar(escala);
  return g;
}

// Cadeira giratória de escritório; a frente aponta para +z
export function criarCadeira() {
  const g = new THREE.Group();
  const tecido = mat('#1f4a52', { roughness: 0.85 });
  const preto = mat('#1b1f23', { roughness: 0.5, metalness: 0.4 });
  const assento = caixa(0.52, 0.09, 0.5, tecido, 0.03);
  assento.position.y = 0.52;
  const encosto = caixa(0.5, 0.56, 0.07, tecido, 0.03);
  encosto.position.set(0, 0.88, -0.24);
  encosto.rotation.x = -0.12;
  const coluna = cilindro(0.025, 0.025, 0.34, preto, 10);
  coluna.position.y = 0.3;
  const haste = caixa(0.04, 0.18, 0.04, preto, 0.01);
  haste.position.set(0, 0.7, -0.22);
  g.add(assento, encosto, coluna, haste);
  for (let i = 0; i < 5; i++) { // base em estrela com rodinhas
    const a = (i / 5) * Math.PI * 2;
    const braco = caixa(0.32, 0.03, 0.04, preto, 0.01);
    braco.position.set(Math.cos(a) * 0.16, 0.1, Math.sin(a) * 0.16);
    braco.rotation.y = -a;
    const roda = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), preto);
    roda.position.set(Math.cos(a) * 0.31, 0.04, Math.sin(a) * 0.31);
    g.add(braco, roda);
  }
  [-1, 1].forEach((s) => {
    const apoio = caixa(0.05, 0.04, 0.3, preto, 0.01);
    apoio.position.set(s * 0.29, 0.74, -0.02);
    const sup = caixa(0.03, 0.2, 0.03, preto, 0.008);
    sup.position.set(s * 0.29, 0.64, 0.05);
    g.add(apoio, sup);
  });
  return sombras(g);
}

// Monitor de mesa com teclado e mouse
export function criarComputador() {
  const g = new THREE.Group();
  const preto = mat('#14181c', { roughness: 0.4, metalness: 0.5 });
  const base = cilindro(0.13, 0.15, 0.025, preto, 20);
  base.position.y = 0.0125;
  const pescoco = caixa(0.05, 0.22, 0.04, preto, 0.01);
  pescoco.position.set(0, 0.13, -0.02);
  const moldura = caixa(0.74, 0.46, 0.04, preto, 0.015);
  moldura.position.y = 0.4;
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.4), new THREE.MeshBasicMaterial({ map: tex.telaNotebook() }));
  tela.position.set(0, 0.4, 0.0215);
  const teclado = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.15), new THREE.MeshStandardMaterial({ map: tex.teclado(), roughness: 0.6 }));
  teclado.rotation.x = -Math.PI / 2;
  teclado.position.set(0, 0.006, 0.3);
  const rato = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat('#2b3338', { roughness: 0.4 }));
  rato.scale.set(0.028, 0.014, 0.045);
  rato.position.set(0.32, 0.012, 0.3);
  g.add(base, pescoco, moldura, tela, teclado, rato);
  return sombras(g);
}

// Armário de arquivo de aço com três gavetas
export function criarArquivo() {
  const g = new THREE.Group();
  const aco = mat('#9aa6ac', { metalness: 0.8, roughness: 0.4 });
  const corpo = caixa(0.62, 1.35, 0.62, aco, 0.015);
  corpo.position.y = 0.675;
  g.add(corpo);
  for (let i = 0; i < 3; i++) {
    const frente = caixa(0.54, 0.38, 0.02, mat('#b4bec3', { metalness: 0.7, roughness: 0.35 }), 0.006);
    frente.position.set(0, 0.23 + i * 0.44, 0.315);
    const puxador = caixa(0.18, 0.025, 0.03, mat('#59646b', { metalness: 0.9, roughness: 0.3 }), 0.006);
    puxador.position.set(0, 0.3 + i * 0.44, 0.34);
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), new THREE.MeshStandardMaterial({ map: tex.letreiro(`A-0${i + 1}`, { fundo: '#f6efd8', cor: '#5b4520', borda: '#8a6a2c' }) }));
    etiqueta.position.set(0, 0.4 + i * 0.44, 0.327);
    g.add(frente, puxador, etiqueta);
  }
  return sombras(g);
}

// Bebedouro com garrafão
export function criarBebedouro() {
  const g = new THREE.Group();
  const corpo = caixa(0.38, 0.95, 0.36, mat('#eef1f2', { roughness: 0.45 }), 0.03);
  corpo.position.y = 0.475;
  const garrafao = cilindro(0.14, 0.15, 0.4, new THREE.MeshPhysicalMaterial({ color: '#7fc4e6', transparent: true, opacity: 0.55, roughness: 0.1 }), 16);
  garrafao.position.y = 1.15;
  const gargalo = cilindro(0.05, 0.14, 0.1, new THREE.MeshPhysicalMaterial({ color: '#7fc4e6', transparent: true, opacity: 0.55, roughness: 0.1 }), 16);
  gargalo.position.y = 0.97;
  const nivel = cilindro(0.138, 0.148, 0.28, mat('#5bb3e0', { roughness: 0.2, transparent: true, opacity: 0.8 }), 16);
  nivel.position.y = 1.09;
  const painel = caixa(0.3, 0.14, 0.02, mat('#cfd6da', { roughness: 0.5 }), 0.008);
  painel.position.set(0, 0.7, 0.18);
  [-1, 1].forEach((s) => {
    const torneira = cilindro(0.018, 0.018, 0.06, mat(s < 0 ? '#2f6fd8' : '#d8402c', { roughness: 0.4 }), 10);
    torneira.rotation.x = Math.PI / 2;
    torneira.position.set(s * 0.07, 0.68, 0.205);
    g.add(torneira);
  });
  g.add(corpo, garrafao, gargalo, nivel, painel);
  return sombras(g);
}

// Mural de cortiça com avisos, preso na parede
export function criarQuadroAvisos() {
  const g = new THREE.Group();
  const moldura = caixa(1.12, 0.86, 0.05, mat('#7a5a37', { roughness: 0.7 }), 0.012);
  const cortica = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.76), new THREE.MeshStandardMaterial({ map: tex.quadroAvisos(), roughness: 0.95 }));
  cortica.position.z = 0.0265;
  g.add(moldura, cortica);
  return sombras(g, false);
}

// Relógio de parede
export function criarRelogioParede(raio = 0.28) {
  const g = new THREE.Group();
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(raio + 0.03, raio + 0.03, 0.05, 28), mat('#2b3338', { roughness: 0.4, metalness: 0.5 }));
  aro.rotation.x = Math.PI / 2;
  const mostrador = new THREE.Mesh(new THREE.CircleGeometry(raio, 32), new THREE.MeshStandardMaterial({ map: tex.relogio(), roughness: 0.4 }));
  mostrador.position.z = 0.026;
  g.add(aro, mostrador);
  return g;
}

// Tapete retangular com borda
export function criarTapete(largura, profundidade, cor = '#2f6670') {
  const g = new THREE.Group();
  const borda = new THREE.Mesh(new THREE.PlaneGeometry(largura, profundidade), mat('#e8dcc0', { roughness: 1 }));
  const miolo = new THREE.Mesh(new THREE.PlaneGeometry(largura - 0.3, profundidade - 0.3), mat(cor, { roughness: 1 }));
  miolo.position.z = 0.002;
  g.add(borda, miolo);
  g.rotation.x = -Math.PI / 2;
  g.traverse((o) => (o.receiveShadow = true));
  return g;
}

export function criarLixeira() {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.36, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#8f9ba1', metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }));
  corpo.position.y = 0.18;
  const fundo = cilindro(0.13, 0.13, 0.02, mat('#59646b'), 16);
  fundo.position.y = 0.01;
  g.add(corpo, fundo);
  return sombras(g);
}

// Banco de espera de madeira com pernas de aço
export function criarBanco(largura = 1.8) {
  const g = new THREE.Group();
  const madeira = mat('#a07c52', { roughness: 0.7 });
  const aco = inox();
  const assento = caixa(largura, 0.06, 0.46, madeira, 0.02);
  assento.position.y = 0.46;
  const encosto = caixa(largura, 0.3, 0.05, madeira, 0.02);
  encosto.position.set(0, 0.75, -0.2);
  g.add(assento, encosto);
  [-1, 1].forEach((s) => {
    const perna = caixa(0.05, 0.44, 0.42, aco, 0.01);
    perna.position.set(s * (largura / 2 - 0.12), 0.22, 0);
    const apoio = caixa(0.04, 0.3, 0.04, aco, 0.008);
    apoio.position.set(s * (largura / 2 - 0.12), 0.6, -0.2);
    g.add(perna, apoio);
  });
  return sombras(g);
}
