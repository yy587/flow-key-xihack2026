const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = dpr();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

export class WaveformRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.phase = 0;
    this.level = 0;
    this.targetLevel = 0;
    this.running = true;
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  update(state) { this.targetLevel = state.signalLevel || 0; }

  animate() {
    if (!this.running) return;
    const { context: ctx, width, height } = sizeCanvas(this.canvas);
    ctx.clearRect(0, 0, width, height);
    this.level += (this.targetLevel - this.level) * 0.08;
    this.phase += 0.055;

    ctx.strokeStyle = '#dfe5de';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const drawWave = (alpha, widthScale, speed, color, lineWidth) => {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const n = x / Math.max(width, 1);
        const envelope = Math.sin(Math.PI * n) * this.level;
        const composite = Math.sin(n * 38 + this.phase * speed) * 0.55 +
          Math.sin(n * 73 - this.phase * speed * 0.72) * 0.25 +
          Math.sin(n * 17 + this.phase * 0.6) * 0.2;
        const y = height / 2 + composite * envelope * height * widthScale;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    drawWave(0.16, 0.39, 1.22, '#1f5a42', 7);
    drawWave(1, 0.34, 1, '#1f5a42', 1.8);
    requestAnimationFrame(this.animate);
  }
}

export class PitchCurveRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.points = [];
    this.lastSample = 0;
  }

  reset() { this.points = []; this.draw(); }

  update(state) {
    const now = performance.now();
    if (state.currentHz != null && now - this.lastSample > 65) {
      this.points.push({ t: state.elapsed, cents: state.centsOffset });
      if (this.points.length > 165) this.points.shift();
      this.lastSample = now;
    }
    this.draw();
  }

  draw() {
    const { context: ctx, width, height } = sizeCanvas(this.canvas);
    ctx.clearRect(0, 0, width, height);
    const pad = { x: 18, y: 16 };
    const plotW = width - pad.x * 2;
    const plotH = height - pad.y * 2;

    ctx.strokeStyle = '#e5e9e3';
    ctx.lineWidth = 1;
    [0, .25, .5, .75, 1].forEach((n) => {
      ctx.beginPath(); ctx.moveTo(pad.x, pad.y + plotH * n); ctx.lineTo(width - pad.x, pad.y + plotH * n); ctx.stroke();
    });
    [0, .2, .4, .6, .8, 1].forEach((n) => {
      ctx.beginPath(); ctx.moveTo(pad.x + plotW * n, pad.y); ctx.lineTo(pad.x + plotW * n, height - pad.y); ctx.stroke();
    });

    const centerY = pad.y + plotH / 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#9aa59d';
    ctx.beginPath(); ctx.moveTo(pad.x, centerY); ctx.lineTo(width - pad.x, centerY); ctx.stroke();
    ctx.setLineDash([]);

    if (this.points.length < 2) return;
    const maxTime = Math.max(10.8, this.points[this.points.length - 1].t);
    ctx.beginPath();
    this.points.forEach((point, index) => {
      const x = pad.x + (point.t / maxTime) * plotW;
      const clamped = Math.max(-50, Math.min(50, point.cents));
      const y = centerY - (clamped / 50) * (plotH / 2);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#1f5a42';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    const last = this.points[this.points.length - 1];
    const lastX = pad.x + (last.t / maxTime) * plotW;
    const lastY = centerY - (Math.max(-50, Math.min(50, last.cents)) / 50) * (plotH / 2);
    ctx.fillStyle = '#1f5a42';
    ctx.beginPath(); ctx.arc(lastX, lastY, 4, 0, Math.PI * 2); ctx.fill();
  }
}
