// Miniaturas 3D das telas de administrador: um único renderer desenha cada item uma vez
// e entrega a imagem pronta (PNG), sem abrir um contexto WebGL por cartão
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { criarModelo, criarGaveta } from './modelos.js';

const LARGURA = 320;
const ALTURA = 240;
const registro = new Map(); // chave -> item
const cache = new Map(); // chave -> data URL
let motor = null;
let semWebGL = false;

// Registra o item e devolve a chave para o <img data-mini="...">
export function chaveMini(item) {
  const chave = `${item.tipo}-${item.id}`;
  registro.set(chave, item);
  return chave;
}

function preparar() {
  if (motor || semWebGL) return motor;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(LARGURA, ALTURA, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    pmrem.dispose();
    const luz = new THREE.DirectionalLight('#fff6e6', 2.2);
    luz.position.set(2.5, 4, 3.5);
    const recorte = new THREE.DirectionalLight('#bcd6ff', 0.8);
    recorte.position.set(-3, 2, -3);
    scene.add(luz, recorte, new THREE.HemisphereLight('#e8f4ff', '#8a9a9e', 0.6));
    const camera = new THREE.PerspectiveCamera(30, LARGURA / ALTURA, 0.1, 50);
    const sombra = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 40),
      new THREE.MeshBasicMaterial({ color: '#6f8a90', transparent: true, opacity: 0.28 })
    );
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.002;
    scene.add(sombra);
    motor = { renderer, scene, camera, sombra };
  } catch {
    semWebGL = true;
  }
  return motor;
}

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

function gerar(chave) {
  if (cache.has(chave)) return cache.get(chave);
  const item = registro.get(chave);
  const m = preparar();
  if (!item || !m) return null;

  const eCorpo = item.tipo === 'corpo';
  const modelo = eCorpo ? criarGaveta({ ...item, codigo: item.codigo || 'IML' }) : criarModelo(item.categoria || 'OUTRO', item, 1.5);
  if (eCorpo) {
    // câmara escura atrás da gaveta, para a bandeja sair de dentro da parede
    const fundo = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.62), new THREE.MeshBasicMaterial({ color: '#0b0f11' }));
    fundo.position.set(0, 0.24, -0.02);
    modelo.add(fundo);
    modelo.position.set(0, 0.05, -0.35);
    m.camera.position.set(0.9, 1.25, 3);
    m.camera.lookAt(0, 0.28, 0.2);
  } else {
    modelo.rotation.y = -0.5;
    m.camera.position.set(1.3, 1.35, 3.1);
    m.camera.lookAt(0, 0.62, 0);
  }
  m.scene.add(modelo);
  m.renderer.render(m.scene, m.camera);
  const url = m.renderer.domElement.toDataURL('image/png');
  m.scene.remove(modelo);
  liberar(modelo);
  cache.set(chave, url);
  return url;
}

// Preenche os <img data-mini> da tela aos poucos, para a página não travar
export function preencherMiniaturas(raiz) {
  const imgs = [...raiz.querySelectorAll('img[data-mini]:not([src])')];
  let i = 0;
  const passo = () => {
    if (i >= imgs.length || !raiz.isConnected) return;
    const img = imgs[i++];
    try {
      const url = gerar(img.dataset.mini);
      if (url) img.src = url;
    } catch {
      /* sem miniatura: o cartão continua legível */
    }
    setTimeout(passo, 0);
  };
  passo();
}
