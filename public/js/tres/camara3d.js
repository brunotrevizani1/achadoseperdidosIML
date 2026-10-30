// Câmara fria em 3D no painel: cada gaveta ocupada sai da parede com o corpo coberto por um lençol.
// Gira sozinha de leve e pode ser girada arrastando.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { criarGaveta } from './modelos.js';

const COLUNAS = 4;
const PASSO_X = 0.95;
const PASSO_Y = 0.85;
const BASE = 0.12;

// corpos: itens { id, sexo, cor_pele, ..., codigo }; as gavetas ocupadas aparecem abertas, de baixo para cima
export function montarCamara(container, corpos) {
  const linhas = Math.max(3, Math.ceil(corpos.length / COLUNAS));
  const altoUnidade = BASE + linhas * PASSO_Y + 0.08;
  const largUnidade = COLUNAS * PASSO_X + 0.2;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  const luz = new THREE.DirectionalLight('#f5f9ff', 2.4);
  luz.position.set(3, 7, 6);
  luz.castShadow = true;
  luz.shadow.mapSize.set(1024, 1024);
  Object.assign(luz.shadow.camera, { left: -4, right: 4, top: 5, bottom: -2, near: 1, far: 20 });
  luz.shadow.bias = -0.0005;
  luz.shadow.normalBias = 0.03;
  scene.add(luz, new THREE.HemisphereLight('#e8f4ff', '#8a9a9e', 0.8));

  const palco = new THREE.Group();
  scene.add(palco);
  const inoxEscuro = new THREE.MeshStandardMaterial({ color: '#8f9ba1', metalness: 0.85, roughness: 0.4 });
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(largUnidade, altoUnidade, 1.0), inoxEscuro);
  corpo.position.set(0, altoUnidade / 2, -0.5);
  corpo.castShadow = corpo.receiveShadow = true;
  palco.add(corpo);

  const abertura = new THREE.MeshStandardMaterial({ color: '#0b0f11', roughness: 0.95 });
  const porta = new THREE.MeshStandardMaterial({ color: '#cfd6da', metalness: 0.5, roughness: 0.4 });
  const puxador = new THREE.MeshStandardMaterial({ color: '#6c777d', metalness: 0.8, roughness: 0.4 });
  const geoPorta = new THREE.PlaneGeometry(0.88, 0.72);
  const geoPux = new THREE.BoxGeometry(0.36, 0.035, 0.03);
  for (let i = 0; i < linhas * COLUNAS; i++) {
    const x = ((i % COLUNAS) - (COLUNAS - 1) / 2) * PASSO_X;
    const y0 = BASE + Math.floor(i / COLUNAS) * PASSO_Y;
    const p = new THREE.Mesh(geoPorta, i < corpos.length ? abertura : porta);
    p.position.set(x, y0 + 0.42, 0.003);
    palco.add(p);
    if (i >= corpos.length) {
      const h = new THREE.Mesh(geoPux, puxador);
      h.position.set(x, y0 + 0.22, 0.02);
      palco.add(h);
    }
  }
  corpos.forEach((c, i) => {
    const gaveta = criarGaveta(c);
    gaveta.position.set(((i % COLUNAS) - (COLUNAS - 1) / 2) * PASSO_X, BASE + Math.floor(i / COLUNAS) * PASSO_Y + 0.18, 0);
    palco.add(gaveta);
  });

  const piso = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshStandardMaterial({ color: '#dbe5e8', roughness: 0.5 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  palco.add(piso);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  const alvo = new THREE.Vector3(0, altoUnidade * 0.46, 0.4);
  let angulo = 0.35;
  let arrastando = false;
  let ultimoX = 0;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    arrastando = true;
    ultimoX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    angulo += (e.clientX - ultimoX) * 0.01;
    ultimoX = e.clientX;
  });
  const soltar = () => {
    arrastando = false;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  const ajustar = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const v = THREE.MathUtils.degToRad(camera.fov);
    const porAltura = (altoUnidade + 0.9) / 2 / Math.tan(v / 2);
    const porLargura = (largUnidade + 0.9) / 2 / (Math.tan(v / 2) * camera.aspect);
    camera.position.set(0, altoUnidade * 0.7, Math.max(porAltura, porLargura) + 0.6);
    camera.lookAt(alvo);
  };
  ajustar();
  const observador = new ResizeObserver(ajustar);
  observador.observe(container);

  const relogio = new THREE.Clock();
  let balanco = 1;
  const encerrar = () => {
    renderer.setAnimationLoop(null);
    observador.disconnect();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      [].concat(o.material).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
    renderer.dispose();
    canvas.remove();
  };
  renderer.setAnimationLoop(() => {
    if (!container.isConnected) return encerrar(); // a tela foi trocada
    const t = relogio.getElapsedTime();
    balanco += ((arrastando ? 0 : 1) - balanco) * 0.05; // volta ao balanço suave depois de soltar
    palco.rotation.y = angulo + Math.sin(t * 0.5) * 0.35 * balanco;
    renderer.render(scene, camera);
  });
  return encerrar;
}
