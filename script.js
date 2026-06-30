const card = document.getElementById('card');
const cardInner = document.getElementById('cardInner');
const openBtn = document.getElementById('openBtn');
const configBtn = document.getElementById('configBtn');
const modal = document.getElementById('modal');
const saveBtn = document.getElementById('saveBtn');
const closeBtn = document.getElementById('closeBtn');

let confettiActive = false;
let confettiPieces = [];
let animationId = null;

function openCard() {
  cardInner.classList.add('open');
  startConfetti();
}

openBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openCard();
});

card.addEventListener('click', () => {
  if (!cardInner.classList.contains('open')) {
    openCard();
  }
});

configBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('editTitle').value = document.getElementById('title').textContent;
  document.getElementById('editSubtitle').value = document.getElementById('subtitle').textContent;
  document.getElementById('editGreeting').value = document.getElementById('greeting').textContent;
  document.getElementById('editMessage').value = document.getElementById('message').innerText;
  document.getElementById('editSignature').value = document.getElementById('signature').textContent;
  document.getElementById('editSticker').value = document.querySelector('.sticker').textContent;
  modal.classList.add('open');
});

function saveSettings() {
  document.getElementById('title').textContent = document.getElementById('editTitle').value;
  document.getElementById('subtitle').textContent = document.getElementById('editSubtitle').value;
  document.getElementById('greeting').textContent = document.getElementById('editGreeting').value;
  document.getElementById('message').innerHTML = document.getElementById('editMessage').value.replace(/\n/g, '<br>');
  document.getElementById('signature').textContent = document.getElementById('editSignature').value;
  document.querySelector('.sticker').textContent = document.getElementById('editSticker').value || '🎉';
  modal.classList.remove('open');
}

saveBtn.addEventListener('click', saveSettings);

closeBtn.addEventListener('click', () => modal.classList.remove('open'));

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('open');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') modal.classList.remove('open');
});

function createConfettiPiece() {
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#ff6348'];
  return {
    x: Math.random() * window.innerWidth,
    y: -20,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: Math.random() * 3 + 2,
    vx: (Math.random() - 0.5) * 4,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 10,
    opacity: 1,
  };
}

function drawConfetti(ctx) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (let i = confettiPieces.length - 1; i >= 0; i--) {
    const p = confettiPieces[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.rotation += p.rotSpeed;
    if (p.y > window.innerHeight + 20) {
      confettiPieces.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
}

function startConfetti() {
  if (confettiActive) return;
  confettiActive = true;
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let count = 0;
  function burst() {
    if (!confettiActive) return;
    for (let i = 0; i < 5; i++) {
      confettiPieces.push(createConfettiPiece());
    }
    count++;
    if (count < 60) requestAnimationFrame(burst);
  }
  burst();

  function animate() {
    if (!confettiActive) return;
    drawConfetti(ctx);
    animationId = requestAnimationFrame(animate);
  }
  animate();

  setTimeout(() => {
    confettiActive = false;
    if (animationId) cancelAnimationFrame(animationId);
    setTimeout(() => {
      confettiPieces = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 3000);
  }, 5000);
}

window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
