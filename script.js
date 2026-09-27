document.getElementById('year').textContent = new Date().getFullYear();

(() => {
  const name = document.getElementById('name-easter-egg');
  const photoButton = document.getElementById('photo-spark');
  const profilePhoto = document.getElementById('profile-photo');
  const portraitFallback = document.getElementById('portrait-fallback');
  const whoamiToggle = document.getElementById('whoami-toggle');
  const whoamiTerminal = document.getElementById('whoami-terminal');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function handleProfileError() {
    if (!profilePhoto.dataset.localTried && profilePhoto.dataset.localFallback) {
      profilePhoto.dataset.localTried = 'true';
      profilePhoto.src = profilePhoto.dataset.localFallback;
      return;
    }
    profilePhoto.hidden = true;
    portraitFallback.hidden = false;
  }

  profilePhoto.addEventListener('error', handleProfileError);
  if (profilePhoto.complete && profilePhoto.naturalWidth === 0) {
    handleProfileError();
  }

  whoamiToggle.addEventListener('click', () => {
    const opening = whoamiTerminal.hidden;
    whoamiTerminal.hidden = !opening;
    whoamiToggle.setAttribute('aria-expanded', String(opening));
    whoamiToggle.textContent = opening ? '> whoami  −' : '> whoami';
  });

  const canvas = document.createElement('canvas');
  canvas.id = 'site-effects';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '9999'
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let dpr = 1;
  let particles = [];
  let animationFrame = null;
  let previousTime = 0;

  const confettiPalette = ['#1772d0', '#f09228', '#657786', '#8c78a8', '#4c8b87'];
  const sparklePalette = ['#1772d0', '#f09228', '#9b7bb5', '#d0a85c'];
  const glyphs = ['λ', '∇', 'σ', 'μ', 'π'];
  const tensors = [
    [[1, 0], [0, 1]],
    [[0, 1], [1, 0]],
    [[1, 1], [0, 1]]
  ];

  const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  function startAnimation() {
    if (!animationFrame && particles.length) {
      animationFrame = requestAnimationFrame(drawFrame);
    }
  }

  function burstName() {
    if (reducedMotion.matches) return;
    const rect = name.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height * 0.55;
    const now = performance.now();

    for (let i = 0; i < 46; i += 1) {
      const roll = Math.random();
      const kind = roll < 0.58 ? 'ribbon' : roll < 0.80 ? 'glyph' : 'tensor';
      const angle = -Math.PI * (0.15 + Math.random() * 0.70);
      const speed = 2.0 + Math.random() * 2.6;

      particles.push({
        kind,
        x: originX + (Math.random() - 0.5) * 24,
        y: originY + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.sin(angle) * speed - 0.8,
        gravity: 0.07 + Math.random() * 0.035,
        drag: 0.993,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.13,
        size: 7 + Math.random() * 6,
        color: randomFrom(confettiPalette),
        glyph: randomFrom(glyphs),
        tensor: randomFrom(tensors),
        born: now,
        life: 1300 + Math.random() * 800
      });
    }
    startAnimation();
  }

  function burstPhoto() {
    if (reducedMotion.matches) return;
    const rect = photoButton.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.48;
    const now = performance.now();

    for (let i = 0; i < 30; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const edge = radius * (0.88 + Math.random() * 0.12);
      const speed = 0.55 + Math.random() * 1.15;
      particles.push({
        kind: Math.random() < 0.24 ? 'diamond' : 'spark',
        x: cx + Math.cos(angle) * edge,
        y: cy + Math.sin(angle) * edge,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0,
        drag: 0.978,
        rotation: angle,
        spin: 0,
        size: 1.8 + Math.random() * 2.5,
        color: randomFrom(sparklePalette),
        born: now,
        life: 620 + Math.random() * 480
      });
    }
    startAnimation();
  }

  function drawTensor(particle, alpha) {
    const s = particle.size;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = particle.color;
    ctx.fillStyle = particle.color;
    ctx.lineWidth = 1;
    ctx.font = `${Math.max(6, s * 0.46)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const w = s * 1.15;
    const h = s * 0.9;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, -h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2 + 2, h / 2);
    ctx.moveTo(w / 2 - 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(w / 2 - 2, h / 2);
    ctx.stroke();

    const dx = s * 0.22;
    const dy = s * 0.2;
    ctx.fillText(String(particle.tensor[0][0]), -dx, -dy);
    ctx.fillText(String(particle.tensor[0][1]), dx, -dy);
    ctx.fillText(String(particle.tensor[1][0]), -dx, dy);
    ctx.fillText(String(particle.tensor[1][1]), dx, dy);
    ctx.restore();
  }

  function drawParticle(particle, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.fillStyle = particle.color;

    if (particle.kind === 'ribbon') {
      ctx.fillRect(-particle.size * 0.6, -particle.size * 0.14, particle.size * 1.2, particle.size * 0.28);
    } else if (particle.kind === 'glyph') {
      ctx.font = `600 ${particle.size + 3}px Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(particle.glyph, 0, 0);
    } else if (particle.kind === 'spark') {
      ctx.beginPath();
      ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(0, -particle.size * 1.6);
      ctx.lineTo(particle.size * 0.72, 0);
      ctx.lineTo(0, particle.size * 1.6);
      ctx.lineTo(-particle.size * 0.72, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFrame(time) {
    const dt = previousTime ? Math.min((time - previousTime) / 16.667, 2) : 1;
    previousTime = time;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    particles = particles.filter((particle) => {
      const age = time - particle.born;
      if (age >= particle.life) return false;

      particle.vx *= Math.pow(particle.drag, dt);
      particle.vy *= Math.pow(particle.drag, dt);
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;

      const progress = age / particle.life;
      const alpha = progress < 0.68 ? 1 : Math.max(0, (1 - progress) / 0.32);
      if (particle.kind === 'tensor') drawTensor(particle, alpha);
      else drawParticle(particle, alpha);
      return true;
    });

    if (particles.length) {
      animationFrame = requestAnimationFrame(drawFrame);
    } else {
      animationFrame = null;
      previousTime = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  name.addEventListener('click', burstName);
  name.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      burstName();
    }
  });
  photoButton.addEventListener('click', burstPhoto);
})();
