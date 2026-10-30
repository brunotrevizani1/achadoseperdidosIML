// Porta de aço com moldura, placa e um corredor claro ao fundo. A folha gira na dobradiça da esquerda, para fora.
// Usada na recepção (com teclado de senha, para entrar) e na sala (sem teclado, para sair).
import * as THREE from 'three';
import * as tex from './texturas.js';

export const ABERTURA_PORTA = 1.6; // quanto a folha gira ao abrir (radianos)

export function criarPorta({ rotulo, fundo = '#7a1f2b', borda = '#e0a3ac', teclado = false }) {
  const g = new THREE.Group();
  const aco = new THREE.MeshStandardMaterial({ color: '#7b8f94', metalness: 0.6, roughness: 0.45 });
  const moldura = new THREE.MeshStandardMaterial({ color: '#c3ccd1', metalness: 0.9, roughness: 0.3 });

  const vao = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.4), new THREE.MeshBasicMaterial({ map: tex.corredor() }));
  vao.position.set(0, 1.2, 0.012);
  g.add(vao);
  [-0.55, 0.55].forEach((x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.14), moldura);
    m.position.set(x, 1.25, 0.07);
    g.add(m);
  });
  const topo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.14), moldura);
  topo.position.set(0, 2.5, 0.07);
  g.add(topo);
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.22), new THREE.MeshStandardMaterial({ map: tex.letreiro(rotulo, { fundo, borda }), roughness: 0.6 }));
  placa.position.set(0, 2.82, 0.02);
  g.add(placa);

  const folha = new THREE.Group();
  folha.position.set(-0.5, 0, 0.05);
  const painel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.38, 0.06), aco);
  painel.position.set(0.5, 1.19, 0);
  const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.55), new THREE.MeshStandardMaterial({ color: '#12343b', metalness: 0.4, roughness: 0.15 }));
  visor.position.set(0.5, 1.75, 0.031);
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 14), moldura);
  barra.position.set(0.82, 1.1, 0.07);
  folha.add(painel, visor, barra);
  g.add(folha);

  let led = null;
  if (teclado) {
    const t = new THREE.Group();
    t.position.set(1.0, 1.35, 0.05);
    t.scale.setScalar(1.3);
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.56, 0.07), new THREE.MeshStandardMaterial({ color: '#1b1f23', roughness: 0.5, metalness: 0.4 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.54), new THREE.MeshStandardMaterial({ map: tex.painelSenha(), roughness: 0.5 }));
    face.position.z = 0.036;
    led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), new THREE.MeshBasicMaterial({ color: '#ff3b3b' }));
    led.position.set(0.12, 0.24, 0.045);
    t.add(corpo, face, led);
    g.add(t);
  }

  // áreas que respondem ao mouse: a porta inteira (e o teclado, se houver); invisíveis e baratas de testar
  const area = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(x, y, 0.1);
    g.add(m);
    return m;
  };
  const alvos = [area(1.3, 2.6, 0, 1.3)];
  if (teclado) alvos.push(area(0.7, 0.9, 1.0, 1.35));
  g.traverse((o) => {
    if (o.isMesh && o.material.visible !== false) o.castShadow = o.receiveShadow = true;
  });
  return { grupo: g, folha, alvos, led };
}
