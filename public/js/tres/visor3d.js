// Visualizador 3D de um item: gira sozinho e pode ser girado arrastando
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { criarModelo } from './modelos.js';

// Devolve uma função que encerra o visualizador e libera a memória
export function mostrarModelo(container, item) {
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
  scene.environmentIntensity = 0.9;
  pmrem.dispose();

  const sol = new THREE.DirectionalLight('#fff3dc', 2.4);
  sol.position.set(2.5, 4, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -1.5, right: 1.5, top: 2.6, bottom: -2, near: 0.5, far: 14 });
  sol.shadow.bias = -0.0005;
  scene.add(sol, new THREE.HemisphereLight('#cfe6ff', '#8a7a68', 0.5));

  const tipo = item.tipo === 'corpo' ? 'PESSOA' : item.categoria;
  const modelo = criarModelo(tipo, item, tipo === 'PESSOA' ? 2.1 : 1.6);
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.1, 0.12, 64),
    new THREE.MeshStandardMaterial({ color: '#c9a574', roughness: 0.6 })
  );
  pedestal.position.y = -0.06;
  pedestal.receiveShadow = true;
  const mesa = new THREE.Group();
  mesa.add(modelo);
  const palco = new THREE.Group();
  palco.add(pedestal, mesa);
  palco.rotation.x = 0.0;
  scene.add(palco);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 1.6, tipo === 'PESSOA' ? 5.6 : 4.6);
  camera.lookAt(0, tipo === 'PESSOA' ? 0.95 : 0.7, 0);

  let angulo = 0.6;
  let arrastando = false;
  let ultimoX = 0;
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    arrastando = true;
    ultimoX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    angulo += (e.clientX - ultimoX) * 0.012;
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
  };
  ajustar();
  const observador = new ResizeObserver(ajustar);
  observador.observe(container);

  const relogio = new THREE.Clock();
  const inicio = performance.now();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(relogio.getDelta(), 0.05);
    if (!arrastando) angulo += dt * 0.6;
    const entrada = Math.min(1, (performance.now() - inicio) / 700); // chega girando
    const e = 1 - (1 - entrada) ** 3;
    mesa.rotation.y = angulo + (1 - e) * -Math.PI * 2;
    mesa.scale.setScalar(0.3 + 0.7 * e);
    renderer.render(scene, camera);
  });

  return () => {
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
}
