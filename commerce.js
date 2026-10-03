import {PROTOTYPE_BOM, PRODUCTS, TONE_CONTOURS} from './commerce-data.js';

const $ = selector => document.querySelector(selector);
const money = cents => `¥${(cents / 100).toFixed(2)}`;
const total = PROTOTYPE_BOM.reduce((sum, item) => sum + item.cents, 0);
const rows = PROTOTYPE_BOM.map(item => {
  const row = document.createElement('tr');
  const name = document.createElement('th');
  name.scope = 'row'; name.textContent = item.name;
  const cost = document.createElement('td'); cost.textContent = money(item.cents);
  row.append(name, cost); return row;
});
$('#bomRows').replaceChildren(...rows);
$('#bomTotal').textContent = (total / 100).toFixed(2);
$('#bomTableTotal').textContent = money(total);

const tabs = [...document.querySelectorAll('[data-product]')];
function selectProduct(key, focus = false) {
  const product = PRODUCTS[key];
  if (!product) return;
  tabs.forEach(tab => {
    const active = tab.dataset.product === key;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  $('#productDetail').setAttribute('aria-labelledby', `matrix-${key}`);
  $('#productDetail').dataset.product = key;
  $('#productStage').textContent = product.stage;
  $('#productName').textContent = product.name;
  $('#productPosition').textContent = product.position;
  $('#productUsers').textContent = product.users;
  $('#productFeatures').textContent = product.features;
  $('#productBusiness').textContent = product.business;
  $('#productBoundary').textContent = product.boundary;
  $('#eduProductMedia').hidden = key !== 'edu';
  $('#tonePreview').hidden = key !== 'tone';
  cancelAnimationFrame(toneFrame);
  if (key === 'tone') drawTone(1);
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectProduct(tab.dataset.product));
  tab.addEventListener('keydown', event => {
    const next = event.key === 'ArrowDown' ? (index + 1) % tabs.length
      : event.key === 'ArrowUp' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (next !== null) {event.preventDefault(); selectProduct(tabs[next].dataset.product, true);}
  });
});

const canvas = $('#toneCanvas');
const ctx = canvas.getContext('2d');
let toneIndex = 0;
let toneFrame = 0;
function drawTone(progress) {
  if (!ctx) return;
  const width = 680, height = 270;
  const scale = Math.min(devicePixelRatio || 1, 2);
  if (canvas.width !== width * scale) {canvas.width = width * scale; canvas.height = height * scale;}
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, width, height);
  const points = TONE_CONTOURS[toneIndex].points;
  const xs = [160, 340, 520];
  const y = value => 215 - value * 155;
  ctx.strokeStyle = '#dadada'; ctx.lineWidth = 1;
  for (const row of [60, 110, 160, 215]) {ctx.beginPath();ctx.moveTo(60, row);ctx.lineTo(620, row);ctx.stroke();}
  ctx.fillStyle = '#6e6e6e'; ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillText('音高', 28, 44); ctx.fillText('发音过程 →', 548, 252);
  xs.forEach((x, index) => {
    const eased = 1 - Math.pow(1 - Math.max(0, Math.min(1, progress * 1.5 - index * .25)), 3);
    const top = y(.06 + (points[index] - .06) * eased);
    ctx.fillStyle = '#c7c7c7'; ctx.fillRect(x - 28, top, 56, 215 - top);
    ctx.fillStyle = '#181818';ctx.textAlign = 'center';ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.fillText(['前段', '中段', '后段'][index], x, 240);
  });
  ctx.textAlign = 'start';ctx.strokeStyle = '#333333';ctx.lineWidth = 3;
  ctx.beginPath();ctx.moveTo(xs[0], y(points[0]));
  for (let i = 1; i <= 80 * progress; i++) {
    const t = i / 80 * 2;
    const segment = Math.min(1, Math.floor(t));
    const fraction = t - segment;
    ctx.lineTo(xs[segment] + fraction * 180, y(points[segment] + fraction * (points[segment + 1] - points[segment])));
  }
  ctx.stroke();
  xs.forEach((x, index) => {
    if (progress * 2 >= index) {ctx.fillStyle = '#181818';ctx.beginPath();ctx.arc(x, y(points[index]), 5, 0, Math.PI * 2);ctx.fill();}
  });
}
function playTone() {
  cancelAnimationFrame(toneFrame);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {drawTone(1);return;}
  const started = performance.now();
  const tick = now => {const progress = Math.min(1, (now - started) / 1400);drawTone(progress);if(progress < 1) toneFrame = requestAnimationFrame(tick);};
  toneFrame = requestAnimationFrame(tick);
}
document.querySelectorAll('[data-tone]').forEach(button => button.addEventListener('click', () => {
  toneIndex = Number(button.dataset.tone);
  document.querySelectorAll('[data-tone]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('#toneCaption').textContent = TONE_CONTOURS[toneIndex].label;
  canvas.setAttribute('aria-label', TONE_CONTOURS[toneIndex].name);
  playTone();
}));
$('#toneReplay').addEventListener('click', playTone);
document.addEventListener('visibilitychange', () => {if(document.hidden) cancelAnimationFrame(toneFrame);});
selectProduct('edu');
