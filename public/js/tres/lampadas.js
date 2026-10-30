// Luminárias de teto que acendem e apagam: tubos que brilham, halo, mancha de luz e reflexo no piso, e o resto da cena
// escurece quando estão apagadas. Tudo é barato de desenhar (nenhuma luz extra): só brilho aditivo e a luz geral da cena.
// O estado fica salvo no navegador.
import * as THREE from 'three';

const CHAVE = 'iml-luzes';

const lerEstado = () => {
  try {
    return localStorage.getItem(CHAVE) !== 'off';
  } catch {
    return true;
  }
};
const guardarEstado = (ligada) => {
  try {
    localStorage.setItem(CHAVE, ligada ? 'on' : 'off');
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
};

// Mancha de luz suave (degradê radial) para o halo das luminárias e para o brilho no piso
function degradeSuave() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// Ao acender, a luz falha uma vez (curva suave, nada de pisca-pisca duro) e firma
const ACENDER = [[0, 0], [90, 0.55], [190, 0.2], [310, 0.85], [400, 0.62], [560, 1]];
const suavizar = (x) => x * x * (3 - 2 * x);
function curvaAcender(e) {
  if (e >= ACENDER[ACENDER.length - 1][0]) return 1;
  for (let i = 1; i < ACENDER.length; i++) {
    if (e < ACENDER[i][0]) {
      const [t0, v0] = ACENDER[i - 1];
      const [t1, v1] = ACENDER[i];
      return v0 + (v1 - v0) * suavizar((e - t0) / (t1 - t0));
    }
  }
  return 1;
}

// posicoes: [[x, z, largura]], y: altura das luminárias, aoMudar(t): chamado com o brilho de 0 (apagado) a 1 (aceso)
export function criarLampadas(cena, { posicoes, y, aoMudar }) {
  const grupo = new THREE.Group();
  const aco = new THREE.MeshStandardMaterial({ color: '#9aa6ac', metalness: 0.8, roughness: 0.4 });
  const tubos = new THREE.MeshStandardMaterial({ color: '#d5dcdf', emissive: '#f4fbff', emissiveIntensity: 0, roughness: 0.4 });
  const alvos = [];
  const brilhos = []; // materiais aditivos: halo, mancha de luz e reflexo no piso
  const suave = degradeSuave();
  const aditivo = (cor, opacidadeMax) => {
    const m = new THREE.MeshBasicMaterial({ map: suave, color: cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    brilhos.push([m, opacidadeMax]);
    return m;
  };
  const geoHaste = new THREE.CylinderGeometry(0.012, 0.012, 2.2, 6);

  posicoes.forEach(([x, z, largura]) => {
    const l = new THREE.Group();
    l.position.set(x, y, z);
    const carcaca = new THREE.Mesh(new THREE.BoxGeometry(largura, 0.09, 0.5), aco);
    const difusor = new THREE.Mesh(new THREE.BoxGeometry(largura - 0.1, 0.02, 0.4), tubos);
    difusor.position.y = -0.052;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(largura + 1.2, 1.0), aditivo('#cfeeff', 0.13));
    halo.position.set(0, -0.12, 0.4);
    l.add(carcaca, difusor, halo);
    [-1, 1].forEach((s) => { // hastes presas ao teto
      const haste = new THREE.Mesh(geoHaste, aco);
      haste.position.set(s * largura * 0.38, 1.1, 0);
      l.add(haste);
    });
    const area = new THREE.Mesh(new THREE.BoxGeometry(largura + 0.5, 0.9, 1.2), new THREE.MeshBasicMaterial({ visible: false }));
    area.position.y = -0.1;
    l.add(area);
    alvos.push(area);
    grupo.add(l);

    // luz que cai no piso (mancha larga) e o reflexo da luminária no piso polido (faixa clara)
    const mancha = new THREE.Mesh(new THREE.PlaneGeometry(largura + 1.8, 2.6), aditivo('#e6f6ff', 0.06));
    mancha.rotation.x = -Math.PI / 2;
    mancha.position.set(x, 0.012, z);
    const reflexo = new THREE.Mesh(new THREE.PlaneGeometry(largura * 0.9, 0.5), aditivo('#ffffff', 0.1));
    reflexo.rotation.x = -Math.PI / 2;
    reflexo.position.set(x, 0.014, z + 0.5);
    grupo.add(mancha, reflexo);
  });

  // forro do teto, para as luminárias não ficarem soltas no ar
  const forro = new THREE.Mesh(new THREE.PlaneGeometry(80, 26), new THREE.MeshStandardMaterial({ color: '#e6ecee', roughness: 0.9 }));
  forro.rotation.x = Math.PI / 2;
  forro.position.set(0, y + 2.2, 11.7);
  grupo.add(forro);
  cena.add(grupo);

  const lampadas = {
    grupo,
    alvos,
    ligada: lerEstado(),
    t: 0,
    anim: null,
    aplicar(t) {
      lampadas.t = t;
      tubos.emissiveIntensity = t * 1.3;
      brilhos.forEach(([m, max]) => (m.opacity = t * max));
      aoMudar?.(t);
    },
    alternar() {
      lampadas.ligada = !lampadas.ligada;
      guardarEstado(lampadas.ligada);
      lampadas.anim = { inicio: performance.now(), de: lampadas.t, ligando: lampadas.ligada };
    },
    // devolve true enquanto o brilho está mudando (a cena precisa desenhar)
    atualizar(agora) {
      const a = lampadas.anim;
      if (!a) return false;
      const e = agora - a.inicio;
      if (a.ligando) {
        const t = curvaAcender(e);
        if (t >= 1) lampadas.anim = null;
        lampadas.aplicar(t);
      } else if (e >= 350) {
        lampadas.anim = null;
        lampadas.aplicar(0);
      } else {
        lampadas.aplicar(a.de * (1 - suavizar(e / 350)));
      }
      return true;
    },
    rotulo: () => (lampadas.ligada ? 'Luzes · clique para apagar' : 'Luzes · clique para acender'),
  };
  lampadas.aplicar(lampadas.ligada ? 1 : 0);
  return lampadas;
}

// Brilho geral da cena em função das luminárias: acesas, a cena fica como sempre; apagadas, só sobra uma luz fraca
export function ajustarLuzes(cena, { dir, hemi }, t, base = { dir: 1.7, hemi: 0.58, ambiente: 0.4 }) {
  dir.intensity = base.dir * (0.16 + 0.84 * t);
  hemi.intensity = base.hemi * (0.22 + 0.78 * t);
  cena.environmentIntensity = base.ambiente * (0.25 + 0.75 * t);
}
