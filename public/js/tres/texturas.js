// Texturas desenhadas em canvas (sem arquivos de imagem)
import * as THREE from 'three';

const FONTE = 'Arial, "Segoe UI", system-ui, sans-serif';

const tela = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};

const textura = (canvas, { repete = false, x = 1, y = 1, cor = true } = {}) => {
  const t = new THREE.CanvasTexture(canvas);
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repete) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(x, y);
  }
  return t;
};

// Pseudo-aleatório repetível, para a textura ser sempre a mesma
const sorteio = (semente) => () => ((semente = (semente * 16807) % 2147483647) - 1) / 2147483646;

// Azulejo branco de parede: 4 x 4 peças por textura, com rejunte cinza
export function azulejoParede({ x = 1, y = 1 } = {}) {
  const [c, g] = tela(512, 512);
  const r = sorteio(5);
  g.fillStyle = '#9aa5a8';
  g.fillRect(0, 0, 512, 512);
  const s = 128;
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const tom = 238 + Math.floor(r() * 12);
      const grad = g.createLinearGradient(i * s, j * s, (i + 1) * s, (j + 1) * s);
      grad.addColorStop(0, `rgb(${tom},${tom + 4},${tom + 5})`);
      grad.addColorStop(1, `rgb(${tom - 14},${tom - 8},${tom - 6})`);
      g.fillStyle = grad;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  }
  return textura(c, { repete: true, x, y });
}

// Piso de porcelanato cinza-claro: 4 x 4 peças por textura
export function pisoPorcelanato({ x = 1, y = 1 } = {}) {
  const [c, g] = tela(512, 512);
  const r = sorteio(13);
  g.fillStyle = '#7d8689';
  g.fillRect(0, 0, 512, 512);
  const s = 128;
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const tom = 176 + Math.floor(r() * 18);
      g.fillStyle = `rgb(${tom},${tom + 3},${tom + 4})`;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      for (let k = 0; k < 40; k++) { // pontinhos do porcelanato
        g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '70,80,84'},${0.05 + r() * 0.08})`;
        g.fillRect(i * s + r() * s, j * s + r() * s, 1 + r() * 2, 1 + r() * 2);
      }
    }
  }
  return textura(c, { repete: true, x, y });
}

// Porta de gaveta de câmara fria em inox escovado, com puxador
function portaInoxNovo(numero) {
  const [c, g] = tela(512, 256);
  const grad = g.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#b9c2c7');
  grad.addColorStop(0.5, '#dfe5e8');
  grad.addColorStop(1, '#aab4ba');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  const r = sorteio(21);
  for (let i = 0; i < 260; i++) { // escovado
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '90,100,106'},${r() * 0.1})`;
    g.fillRect(0, r() * 256, 512, 1);
  }
  g.strokeStyle = '#7f8a90';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 506, 250);
  g.fillStyle = '#6c777d'; // puxador
  g.fillRect(176, 196, 160, 14);
  g.fillStyle = '#30393d';
  g.font = `700 44px ${FONTE}`;
  g.textAlign = 'center';
  g.fillText(numero, 256, 80);
  return textura(c);
}

// Texto numa placa horizontal (letreiros)
function letreiroNovo(texto, { fundo = '#0f5e66', cor = '#ffffff', borda = '#8fd0d4' } = {}) {
  const [c, g] = tela(1024, 160);
  g.fillStyle = fundo;
  g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = borda;
  g.lineWidth = 6;
  g.strokeRect(14, 14, 996, 132);
  g.fillStyle = cor;
  let fonte = 84;
  g.font = `700 ${fonte}px ${FONTE}`;
  while (g.measureText(texto).width > 940 && fonte > 30) g.font = `700 ${(fonte -= 4)}px ${FONTE}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texto, 512, 86);
  return textura(c);
}

// Placa institucional na parede, com a balança da justiça
export function placaIML() {
  const [c, g] = tela(1024, 256);
  g.fillStyle = '#12343b';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#c8d6da';
  g.lineWidth = 5;
  g.strokeRect(12, 12, 1000, 232);

  // balança
  g.strokeStyle = '#e4edef';
  g.fillStyle = '#e4edef';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(130, 60); g.lineTo(130, 200);
  g.moveTo(90, 200); g.lineTo(170, 200);
  g.moveTo(66, 82); g.lineTo(194, 82);
  g.stroke();
  [[66, 0], [194, 0]].forEach(([px]) => {
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(px, 82); g.lineTo(px - 24, 130); g.moveTo(px, 82); g.lineTo(px + 24, 130);
    g.stroke();
    g.beginPath();
    g.arc(px, 130, 24, 0, Math.PI, false);
    g.closePath();
    g.fill();
  });

  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.font = `700 76px ${FONTE}`;
  g.fillText('INSTITUTO', 250, 100);
  g.fillText('MÉDICO LEGAL', 250, 184);
  g.fillStyle = '#8fd0d4';
  g.font = `600 30px ${FONTE}`;
  g.textAlign = 'right';
  g.fillText('IML', 984, 60);
  return textura(c);
}

// Relógio de parede
export function relogio() {
  const [c, g] = tela(256, 256);
  g.fillStyle = '#f8fafb';
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2b3438';
  g.lineWidth = 8;
  g.stroke();
  g.lineWidth = 5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
    g.lineTo(128 + Math.sin(a) * 108, 128 - Math.cos(a) * 108);
    g.stroke();
  }
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(Math.PI * 0.3) * 54, 128 - Math.cos(Math.PI * 0.3) * 54); g.stroke();
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(Math.PI * 1.5) * 84, 128 - Math.cos(Math.PI * 1.5) * 84); g.stroke();
  return textura(c);
}

// Texto quebrado em linhas, num cartão de papel (etiquetas e pasta de ficha)
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
    g.font = `600 30px ${FONTE}`;
    g.fillStyle = borda;
    g.fillText(rotulo.toUpperCase(), w / 2, topo);
    topo += 20;
  }
  g.fillStyle = '#2a2433';
  g.font = `700 44px ${FONTE}`;
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

// Etiqueta de identificação amarrada no dedo do pé: furo, código e linhas para anotação
export function etiquetaDedo(codigo) {
  const [c, g] = tela(512, 256);
  g.fillStyle = '#f6efd8';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#8a6d1f';
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 236);
  g.fillStyle = '#8a6d1f';
  g.beginPath();
  g.arc(256, 36, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a2433';
  g.textAlign = 'center';
  g.font = `700 34px ${FONTE}`;
  g.fillText('IML · NÃO IDENTIFICADO', 256, 100);
  let fonte = 46;
  g.font = `700 ${fonte}px ${FONTE}`;
  while (g.measureText(codigo).width > 440 && fonte > 20) g.font = `700 ${(fonte -= 2)}px ${FONTE}`;
  g.fillText(codigo, 256, 170);
  g.fillStyle = '#b3392a';
  g.fillRect(40, 205, 432, 6);
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

// Tatuagens: tinta azul-acinzentada num ladrilho transparente que se repete pelo membro inteiro.
// `centro`/`largura` (em fração da volta, 0 = frente, 0.5 = costas) limitam o desenho a uma faixa, para peito e costas.
const TINTA = 'rgba(28, 42, 72, .9)';

const DESENHOS = {
  // faixas de setas, linhas e pontos
  TRIBAL(g) {
    [128, 384].forEach((cx) => {
      for (let k = 0; k < 8; k++) {
        const y = 14 + k * 62;
        g.beginPath();
        g.moveTo(cx - 32, y + 30);
        g.lineTo(cx, y);
        g.lineTo(cx + 32, y + 30);
        g.lineTo(cx + 15, y + 30);
        g.lineTo(cx, y + 14);
        g.lineTo(cx - 15, y + 30);
        g.closePath();
        g.fill();
        g.beginPath();
        g.arc(cx, y + 48, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.lineWidth = 8;
      [-62, 62].forEach((d) => {
        g.beginPath();
        g.moveTo(cx + d, 0);
        g.lineTo(cx + d, 512);
        g.stroke();
      });
    });
  },
  // rosas com folhas e botões
  FLORAL(g) {
    const rosa = (cx, cy, r) => {
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = Math.max(3, r * 0.09);
      [0.28, 0.52, 0.76].forEach((f, i) => {
        g.beginPath();
        g.arc(cx, cy, r * f, 0.5 + i * 1.6, 0.5 + i * 1.6 + 4.1);
        g.stroke();
      });
      g.restore();
    };
    const folha = (cx, cy, rx, ry, rot) => {
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
    };
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(128, 150);
    g.bezierCurveTo(200, 230, 300, 280, 384, 380);
    g.moveTo(384, 130);
    g.bezierCurveTo(330, 60, 200, 40, 128, 390);
    g.stroke();
    rosa(128, 140, 62);
    rosa(384, 384, 62);
    rosa(384, 124, 36);
    rosa(128, 388, 36);
    [[215, 215, 0.6], [300, 300, 0.6], [250, 60, -0.4], [262, 450, -0.4], [60, 262, 1.2], [450, 250, 1.2]].forEach(([x, y, r]) => folha(x, y, 34, 13, r));
  },
  // losangos encaixados e pontos
  GEOMETRICO(g) {
    [[128, 128], [384, 128], [128, 384], [384, 384]].forEach(([cx, cy]) => {
      g.lineWidth = 7;
      [74, 52, 30].forEach((s) => {
        g.beginPath();
        g.moveTo(cx, cy - s);
        g.lineTo(cx + s, cy);
        g.lineTo(cx, cy + s);
        g.lineTo(cx - s, cy);
        g.closePath();
        g.stroke();
      });
      g.beginPath();
      g.arc(cx, cy, 9, 0, Math.PI * 2);
      g.fill();
    });
    [[256, 256], [256, 0], [256, 512], [0, 256], [512, 256]].forEach(([x, y]) => {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillRect(-14, -14, 28, 28);
      g.restore();
    });
  },
  // chamas subindo
  CHAMAS(g) {
    const chama = (cx, base, h, w) => {
      g.beginPath();
      g.moveTo(cx - w, base);
      g.bezierCurveTo(cx - w, base - h * 0.45, cx - w * 0.15, base - h * 0.5, cx + w * 0.1, base - h);
      g.bezierCurveTo(cx + w * 0.3, base - h * 0.55, cx + w, base - h * 0.45, cx + w, base);
      g.closePath();
      g.fill();
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.moveTo(cx - w * 0.4, base);
      g.bezierCurveTo(cx - w * 0.4, base - h * 0.3, cx, base - h * 0.35, cx + w * 0.05, base - h * 0.62);
      g.bezierCurveTo(cx + w * 0.2, base - h * 0.35, cx + w * 0.4, base - h * 0.3, cx + w * 0.4, base);
      g.closePath();
      g.fill();
      g.restore();
    };
    [250, 506].forEach((base, linha) => {
      for (let k = 0; k < 4; k++) chama(64 + k * 128, base, 190 + ((k + linha) % 2) * 36, 46);
    });
  },
  // estrelas de cinco pontas de vários tamanhos
  ESTRELAS(g) {
    const estrela = (cx, cy, r) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const raio = i % 2 ? r * 0.42 : r;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * raio, cy + Math.sin(a) * raio);
      }
      g.closePath();
      g.fill();
    };
    [[90, 90, 40], [256, 50, 20], [430, 110, 32], [170, 210, 18], [340, 240, 42], [60, 340, 24], [220, 390, 36], [430, 410, 22], [130, 470, 20], [340, 480, 26]]
      .forEach(([x, y, r]) => estrela(x, y, r));
    [[200, 120], [300, 150], [90, 220], [470, 300], [280, 330], [380, 340], [60, 430], [250, 470]].forEach(([x, y]) => {
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
    });
  },
};

export function tatuagem(estilo = 'TRIBAL', { centro = null, largura = 0.5 } = {}) {
  const [c, g] = tela(512, 512);
  g.fillStyle = TINTA;
  g.strokeStyle = TINTA;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  (DESENHOS[estilo] || DESENHOS.TRIBAL)(g);
  if (centro !== null) { // deixa só uma faixa da volta (com bordas suaves), repetida nas duas pontas para não ter emenda
    const [m, mg] = tela(512, 512);
    const w = largura * 512;
    [-512, 0, 512].forEach((dx) => {
      const cx = centro * 512 + dx;
      const grad = mg.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.18, 'rgba(0,0,0,1)');
      grad.addColorStop(0.82, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      mg.fillStyle = grad;
      mg.fillRect(cx - w / 2, 0, w, 512);
    });
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(m, 0, 0);
  }
  return textura(c, { repete: true });
}

// Tela de notebook: papel de parede em degradê com janelas e barra de tarefas
export function telaNotebook() {
  const [c, g] = tela(512, 320);
  const grad = g.createLinearGradient(0, 0, 512, 320);
  grad.addColorStop(0, '#1d3b66');
  grad.addColorStop(1, '#2f8fa3');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.fillRect(40, 36, 250, 170);
  g.fillStyle = '#d7dee6';
  g.fillRect(40, 36, 250, 24);
  g.fillStyle = '#9aa7b4';
  for (let i = 0; i < 6; i++) g.fillRect(56, 76 + i * 20, 180 - (i % 3) * 40, 8);
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.fillRect(250, 120, 220, 130);
  g.fillStyle = 'rgba(10,20,40,.85)';
  g.fillRect(0, 296, 512, 24);
  return textura(c);
}

// Teclado de notebook visto de cima
export function teclado() {
  const [c, g] = tela(512, 280);
  g.fillStyle = '#9aa1a8';
  g.fillRect(0, 0, 512, 280);
  g.fillStyle = '#1f2328';
  for (let r = 0; r < 5; r++) {
    for (let k = 0; k < 14; k++) {
      const largo = r === 4 && k > 3 && k < 10 ? 0 : 1;
      if (!largo) continue;
      g.fillRect(14 + k * 34.5, 14 + r * 34, 29, 28);
    }
  }
  g.fillRect(14 + 4 * 34.5, 14 + 4 * 34, 29 * 6 + 5.5 * 5, 28); // barra de espaço
  g.fillStyle = '#7f868d';
  g.fillRect(186, 196, 140, 68); // trackpad
  return textura(c);
}

// Teclado numérico com visor da porta de acesso restrito
export function painelSenha() {
  const [c, g] = tela(256, 400);
  g.fillStyle = '#1b1f23';
  g.fillRect(0, 0, 256, 400);
  g.strokeStyle = '#59646b';
  g.lineWidth = 6;
  g.strokeRect(5, 5, 246, 390);
  g.fillStyle = '#0d2a1b'; // visor
  g.fillRect(24, 24, 208, 76);
  g.fillStyle = '#6dff9c';
  g.textAlign = 'center';
  g.font = `700 22px ${FONTE}`;
  g.fillText('ACESSO RESTRITO', 128, 54);
  g.font = `700 30px ${FONTE}`;
  g.fillText('• • • •', 128, 88);
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  teclas.forEach((k, i) => {
    const x = 28 + (i % 3) * 72;
    const y = 124 + Math.floor(i / 3) * 62;
    g.fillStyle = '#cfd6da';
    g.beginPath();
    g.roundRect(x, y, 60, 50, 9);
    g.fill();
    g.fillStyle = '#1b1f23';
    g.font = `700 26px ${FONTE}`;
    g.fillText(k, x + 30, y + 34);
  });
  g.fillStyle = '#8fd0d4';
  g.font = `700 20px ${FONTE}`;
  g.fillText('IML', 128, 388);
  return textura(c);
}

// O corredor que aparece quando a porta se abre
export function corredor() {
  const [c, g] = tela(256, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f4f9fa');
  grad.addColorStop(0.7, '#cfe0e3');
  grad.addColorStop(1, '#8da7ad');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(15,94,102,.25)';
  g.fillRect(0, 380, 256, 6);
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.fillRect(108, 90, 40, 250);
  return textura(c);
}

// Mural de cortiça com avisos presos por alfinetes
export function quadroAvisos() {
  const [c, g] = tela(512, 384);
  const r = sorteio(17);
  g.fillStyle = '#c89a62';
  g.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '120,80,40' : '230,190,130'},${0.12 + r() * 0.2})`;
    g.fillRect(r() * 512, r() * 384, 2 + r() * 4, 2 + r() * 3);
  }
  const avisos = [
    [30, 28, 150, 110, '#fff7b0', -0.05], [210, 20, 120, 150, '#ffffff', 0.04], [350, 36, 130, 100, '#ffc9d6', 0.06],
    [60, 190, 140, 130, '#cfeaff', 0.03], [240, 214, 110, 120, '#ffffff', -0.04], [372, 200, 120, 140, '#d6f5c9', -0.06],
  ];
  avisos.forEach(([x, y, w, h, cor, rot]) => {
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.rotate(rot);
    g.shadowColor = 'rgba(0,0,0,.35)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 3;
    g.fillStyle = cor;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.shadowColor = 'transparent';
    g.fillStyle = '#4b5963';
    g.fillRect(-w / 2 + 12, -h / 2 + 14, w * 0.55, 8);
    g.fillStyle = '#9aa7b0';
    for (let k = 0; k < Math.floor((h - 40) / 16); k++) g.fillRect(-w / 2 + 12, -h / 2 + 34 + k * 16, w - 24 - (k % 3) * 22, 5);
    g.fillStyle = '#d6405a';
    g.beginPath();
    g.arc(0, -h / 2 + 8, 7, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
  return textura(c);
}

// Letreiros e portas se repetem muito: cada combinação é desenhada uma vez só
const cacheTexturas = new Map();
const lembrar = (nome, fabrica) => (...args) => {
  const chave = nome + JSON.stringify(args);
  if (!cacheTexturas.has(chave)) cacheTexturas.set(chave, fabrica(...args));
  return cacheTexturas.get(chave);
};
export const letreiro = lembrar('letreiro', letreiroNovo);
export const portaInox = lembrar('portaInox', portaInoxNovo);
