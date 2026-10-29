// Texturas desenhadas em canvas (sem arquivos de imagem)
import * as THREE from 'three';

const tela = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};

const textura = (canvas, { repete = false, x = 1, y = 1, cor = true } = {}) => {
  const t = new THREE.CanvasTexture(canvas);
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repete) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(x, y);
  }
  return t;
};

// Pseudo-aleatório repetível, para a textura ser sempre a mesma
const sorteio = (semente) => () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;

// Madeira com veios
export function madeira(base = '#9a6a3a', { x = 1, y = 1 } = {}) {
  const [c, g] = tela(512, 512);
  const r = sorteio(7);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const yy = r() * 512;
    g.strokeStyle = `rgba(${r() > 0.5 ? '40,20,5' : '255,220,170'},${0.05 + r() * 0.12})`;
    g.lineWidth = 1 + r() * 3;
    g.beginPath();
    g.moveTo(0, yy);
    for (let xx = 0; xx <= 512; xx += 64) g.lineTo(xx, yy + Math.sin(xx / 90 + i) * (2 + r() * 4));
    g.stroke();
  }
  g.strokeStyle = 'rgba(30,15,0,.35)'; // juntas das tábuas
  g.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(0, i * 128);
    g.lineTo(512, i * 128);
    g.stroke();
  }
  return textura(c, { repete: true, x, y });
}

// Lona listrada (as listras seguem o eixo x da textura)
export function lona(cor = '#d8402c', listras = 14) {
  const [c, g] = tela(1024, 256);
  const w = 1024 / listras;
  for (let i = 0; i < listras; i++) {
    g.fillStyle = i % 2 ? '#f6f1e6' : cor;
    g.fillRect(i * w, 0, w + 1, 256);
  }
  const r = sorteio(3);
  for (let i = 0; i < 2600; i++) { // trama do tecido
    g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    g.fillRect(r() * 1024, r() * 256, 1 + r() * 2, 1);
  }
  return textura(c);
}

// Bandô do toldo: listras com a barra recortada em ondas (o resto é transparente)
export function bando(cor = '#d8402c', listras = 14) {
  const [c, g] = tela(1024, 128);
  const w = 1024 / listras;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1024, 0);
  for (let i = listras - 1; i >= 0; i--) {
    g.lineTo((i + 1) * w, 70);
    g.quadraticCurveTo((i + 0.5) * w, 150, i * w, 70);
  }
  g.closePath();
  g.save();
  g.clip();
  for (let i = 0; i < listras; i++) {
    g.fillStyle = i % 2 ? '#f6f1e6' : cor;
    g.fillRect(i * w, 0, w + 1, 128);
  }
  g.restore();
  return textura(c);
}

// Calçada de pedras
export function calcada() {
  const [c, g] = tela(512, 512);
  const r = sorteio(11);
  g.fillStyle = '#6f6a66';
  g.fillRect(0, 0, 512, 512);
  const n = 8;
  const s = 512 / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const tom = 118 + Math.floor(r() * 46);
      g.fillStyle = `rgb(${tom},${tom - 4},${tom - 8})`;
      const dx = (j % 2) * (s / 2);
      g.beginPath();
      g.roundRect(i * s + dx + 3, j * s + 3, s - 6, s - 6, 9);
      g.fill();
    }
  }
  return textura(c, { repete: true, x: 14, y: 8 });
}

// Céu em degradê
export function ceu() {
  const [c, g] = tela(4, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#7fb8ec');
  grad.addColorStop(0.7, '#cfe8fb');
  grad.addColorStop(1, '#f3f0e4');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  return textura(c);
}

// Fachada de prédio ao fundo
export function fachada(cor = '#cdb89a') {
  const [c, g] = tela(256, 512);
  g.fillStyle = cor;
  g.fillRect(0, 0, 256, 512);
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#4b6b88';
      g.fillRect(24 + i * 58, 30 + j * 60, 34, 40);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(24 + i * 58, 30 + j * 60, 34, 10);
    }
  }
  return textura(c);
}

// Texto quebrado em linhas, num cartão de papel (plaquinhas e pasta de ficha)
export function cartao(titulo, { fundo = '#f8f0d4', borda = '#b3392a', rotulo = '', w = 512, h = 320 } = {}) {
  const [c, g] = tela(w, h);
  g.fillStyle = fundo;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = borda;
  g.lineWidth = 12;
  g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = '#2a2433';
  g.textAlign = 'center';
  let topo = 70;
  if (rotulo) {
    g.font = '600 30px "Fredoka", system-ui, sans-serif';
    g.fillStyle = borda;
    g.fillText(rotulo.toUpperCase(), w / 2, topo);
    topo += 20;
  }
  g.fillStyle = '#2a2433';
  g.font = '700 44px "Fredoka", system-ui, sans-serif';
  const palavras = String(titulo).split(' ');
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const t = atual ? `${atual} ${p}` : p;
    if (g.measureText(t).width > w - 80 && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = t;
  }
  linhas.push(atual);
  const inicio = topo + 30 + (rotulo ? 0 : 10);
  linhas.slice(0, 4).forEach((l, i) => g.fillText(l, w / 2, inicio + i * 52));
  return textura(c);
}

// Letreiro de madeira da frente do balcão
export function letreiro(texto) {
  const [c, g] = tela(1024, 160);
  g.fillStyle = '#2f2a3d';
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = '#f3d27a';
  g.lineWidth = 8;
  g.strokeRect(14, 14, 996, 132);
  g.fillStyle = '#f3d27a';
  g.font = '700 84px "Fredoka", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, 512, 86);
  return textura(c);
}

// Tela de celular com papel de parede e relógio
export function telaCelular() {
  const [c, g] = tela(256, 512);
  const grad = g.createLinearGradient(0, 0, 256, 512);
  grad.addColorStop(0, '#3f6fd8');
  grad.addColorStop(1, '#9b4fd1');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.font = '600 84px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('09:41', 128, 170);
  g.font = '500 22px system-ui, sans-serif';
  g.fillText('quinta-feira', 128, 206);
  return textura(c);
}

// Capa de passaporte / documento
export function capaDocumento() {
  const [c, g] = tela(256, 360);
  g.fillStyle = '#1f3d73';
  g.fillRect(0, 0, 256, 360);
  g.strokeStyle = '#e6c35a';
  g.lineWidth = 5;
  g.strokeRect(16, 16, 224, 328);
  g.fillStyle = '#e6c35a';
  g.beginPath();
  g.arc(128, 150, 48, 0, Math.PI * 2);
  g.stroke();
  g.font = '700 26px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('DOCUMENTO', 128, 262);
  g.fillText('PESSOAL', 128, 294);
  return textura(c);
}

// Carteira de identidade (cartão)
export function cartaoIdentidade() {
  const [c, g] = tela(512, 320);
  g.fillStyle = '#e6efe3';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#3c7a56';
  g.fillRect(0, 0, 512, 56);
  g.fillStyle = '#b8c7d8';
  g.fillRect(28, 84, 140, 180);
  g.fillStyle = '#8697aa';
  g.beginPath();
  g.arc(98, 144, 30, 0, Math.PI * 2);
  g.fill();
  g.fillRect(58, 184, 80, 60);
  g.fillStyle = '#44505c';
  for (let i = 0; i < 5; i++) g.fillRect(200, 94 + i * 36, 260 - (i % 2) * 70, 14);
  return textura(c);
}

// Mostrador do relógio da cena do visor e papel para a pasta
export function papel() {
  const [c, g] = tela(256, 320);
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#9aa3ad';
  for (let i = 0; i < 12; i++) g.fillRect(24, 30 + i * 22, 208 - (i % 3) * 40, 6);
  return textura(c);
}
