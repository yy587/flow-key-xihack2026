import { DemoPitchSource, UnifiedDataAdapter, initialPitchData } from './data-adapter.js';
import { MicrophonePitchSource } from './microphone-source.js';
import { TEACHING_NOTES, COLUMN_LAYOUT, analyzePitch, getTeachingNote } from './pitch-mapping.js';
import { ColumnController } from './column-controller.js';
import { createTeachingFeedback } from './teaching-feedback.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ui = {
  demoShell: $('#demoShell'),
  session: $('#demoSessionLabel'),
  noteSelector: $('#noteSelector'),
  columnTrack: $('#columnTrack'),
  targetNote: $('#targetNoteValue'),
  targetFrequency: $('#targetFrequencyValue'),
  currentNote: $('#currentNoteValue'),
  currentFrequency: $('#currentFrequencyValue'),
  similarity: $('#similarityValue'),
  cents: $('#centsValue'),
  confidence: $('#confidenceValue'),
  lowerName: $('#lowerName'),
  lowerPercent: $('#lowerPercent'),
  lowerBar: $('#lowerBar'),
  upperName: $('#upperName'),
  upperPercent: $('#upperPercent'),
  upperBar: $('#upperBar'),
  feedback: $('#teachingFeedback'),
  feedbackBox: $('#aiFeedback'),
  feedbackHeadline: $('#feedbackHeadline'),
  feedbackMessage: $('#feedbackMessage'),
  microphoneState: $('#microphoneState'),
  signalBar: $('#signalBar'),
  servoStatus: $('#servoStatus'),
  demoSourceButton: $('#demoSourceButton'),
  microphoneSourceButton: $('#microphoneSourceButton'),
  startButton: $('#startButton'),
  resetButton: $('#resetButton'),
  devicePanel: $('#devicePanel'),
  deviceButton: $('#deviceButton'),
  deviceCloseButton: $('#deviceCloseButton'),
  deviceStatus: $('#deviceStatusLabel'),
  panelMicStatus: $('#panelMicStatus'),
  panelNoiseStatus: $('#panelNoiseStatus'),
  exitPresentation: $('#exitPresentationButton'),
  voiceCommand: $('#voiceCommandText'),
  voiceAction: $('#voiceActionText'),
  toast: $('#toast'),
  toastTitle: $('#toastTitle'),
  toastMessage: $('#toastMessage')
};

let targetIndex = 2;
let sourceMode = 'demo';
let isRunning = false;
let lastState = { ...initialPitchData };
let lastAnalysis = analyzePitch(null, targetIndex);
let adapter = null;
let adapterListener = null;
let toastTimer = 0;

const demoSource = new DemoPitchSource(targetIndex);
const microphoneSource = new MicrophonePitchSource(targetIndex);

function buildNoteSelector() {
  ui.noteSelector.innerHTML = '';
  TEACHING_NOTES.forEach((note) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'note-button';
    button.dataset.noteIndex = String(note.index);
    button.innerHTML = `<b>${note.label}</b><small>${note.scientific}</small>`;
    button.setAttribute('aria-label', `选择目标音 ${note.label}，${note.hz.toFixed(2)} 赫兹`);
    button.addEventListener('click', () => selectTarget(note.index));
    ui.noteSelector.append(button);
  });
}

function buildColumns() {
  ui.columnTrack.innerHTML = '';
  COLUMN_LAYOUT.forEach((entry, columnIndex) => {
    const slot = document.createElement(entry.type === 'note' ? 'button' : 'div');
    if (entry.type === 'note') slot.type = 'button';
    slot.className = `column-slot is-${entry.type}`;
    slot.dataset.columnIndex = String(columnIndex);
    if (entry.type === 'note') {
      const note = getTeachingNote(entry.noteIndex);
      slot.dataset.noteIndex = String(note.index);
      slot.setAttribute('aria-label', `${note.label} 音高反馈柱`);
      slot.addEventListener('click', () => selectTarget(note.index));
      slot.innerHTML = `<span class="column-label">${note.label}</span><i class="servo-column"></i>`;
    } else {
      slot.setAttribute('aria-label', `${entry.name}，不承担音高判断`);
      slot.innerHTML = '<span class="column-label">辅助</span><i class="servo-column"></i>';
    }
    ui.columnTrack.append(slot);
  });
}

buildNoteSelector();
buildColumns();

const columnController = new ColumnController(targetIndex);
const columnSlots = $$('.column-slot', ui.columnTrack);
columnController.addEventListener('columns', (event) => {
  renderColumnHeights(event.detail.columnHeights);
});

function renderColumnHeights(heights) {
  columnSlots.forEach((slot, index) => {
    const level = Math.max(0.03, Math.min(1, heights[index] ?? 0.03));
    const column = $('.servo-column', slot);
    const label = $('.column-label', slot);
    column.style.height = `${4 + level * 92}%`;
    label.style.bottom = `${Math.min(94, 8 + level * 86)}%`;
  });
}

function updateColumnStates(analysis) {
  columnSlots.forEach((slot) => {
    const noteIndex = Number(slot.dataset.noteIndex);
    slot.classList.toggle('is-target', slot.dataset.noteIndex != null && noteIndex === targetIndex);
    slot.classList.toggle('is-detected', Boolean(
      analysis?.detected && slot.dataset.noteIndex != null && noteIndex === analysis.detected.index
    ));
  });
}

function selectTarget(index, { silent = false } = {}) {
  targetIndex = getTeachingNote(index).index;
  demoSource.setTarget(targetIndex);
  microphoneSource.setTarget(targetIndex);
  columnController.setTarget(targetIndex);
  $$('.note-button', ui.noteSelector).forEach((button) => {
    const active = Number(button.dataset.noteIndex) === targetIndex;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const target = getTeachingNote(targetIndex);
  renderPitchState({
    ...initialPitchData,
    targetIndex,
    targetNote: target.label,
    targetHz: target.hz,
    source: sourceMode
  });
  if (!silent) showToast('目标音已选择', `${target.label} · ${target.hz.toFixed(2)} 赫兹`);
}

function signedCents(value) {
  const rounded = Math.round(value);
  if (rounded === 0) return '偏差 0 音分';
  return rounded < 0 ? `偏低 ${Math.abs(rounded)} 音分` : `偏高 ${rounded} 音分`;
}

function renderPitchState(state) {
  lastState = state;
  const analysis = analyzePitch(state.currentHz, targetIndex);
  lastAnalysis = analysis;
  const feedback = createTeachingFeedback(analysis, state.confidence);
  const target = getTeachingNote(targetIndex);

  if (Array.isArray(state.columnHeights) && state.columnHeights.length === 15) {
    columnController.setHardwareHeights(state.columnHeights);
  } else {
    columnController.setPitchAnalysis(analysis);
  }

  ui.targetNote.textContent = target.label;
  ui.targetFrequency.textContent = `${target.hz.toFixed(2)} Hz`;
  ui.currentNote.textContent = analysis.detected?.label ?? '—';
  ui.currentFrequency.textContent = analysis.hasSignal ? `${state.currentHz.toFixed(2)} Hz` : '等待发声';
  ui.similarity.textContent = analysis.hasSignal ? `${analysis.similarity}%` : '—';
  ui.cents.textContent = analysis.hasSignal ? signedCents(analysis.centsOffset) : '选择目标音后开始';
  ui.confidence.textContent = feedback.confidenceLabel;

  const lower = analysis.lower;
  const upper = analysis.upper;
  ui.lowerName.textContent = lower?.label ?? getTeachingNote((targetIndex + 11) % 12).label;
  ui.lowerPercent.textContent = `${lower?.weight ?? 0}%`;
  ui.lowerBar.style.width = `${lower?.weight ?? 0}%`;
  ui.upperName.textContent = upper?.label ?? target.label;
  ui.upperPercent.textContent = `${upper?.weight ?? 0}%`;
  ui.upperBar.style.width = `${upper?.weight ?? 0}%`;

  ui.feedbackHeadline.textContent = feedback.headline;
  ui.feedbackMessage.textContent = feedback.message;
  ui.feedbackBox.className = `ai-feedback ${feedback.tone}`;
  ui.feedback.classList.toggle('is-perfect', feedback.tone === 'perfect');
  ui.signalBar.style.width = `${Math.round((state.signalLevel || 0) * 100)}%`;

  isRunning = Boolean(state.isRunning);
  ui.demoShell.classList.toggle('is-running', isRunning);
  ui.startButton.querySelector('span').textContent = isRunning ? '停止' : (state.phase === 'perfect' ? '再次体验' : '开始体验');
  ui.startButton.querySelector('b').textContent = isRunning ? '■' : '→';

  if (sourceMode === 'microphone') {
    ui.microphoneState.textContent = isRunning ? '麦克风正在聆听' : '麦克风待机';
    ui.panelMicStatus.textContent = isRunning ? '正在聆听' : '已授权';
  } else {
    ui.microphoneState.textContent = isRunning ? '模拟声音输入中' : '模拟数据待机';
    ui.panelMicStatus.textContent = '等待启用';
  }

  const phaseLabels = {
    waiting: '教学模式 · 等待开始',
    listening: '教学模式 · 正在识别',
    adjusting: '教学模式 · 正在接近目标音',
    perfect: '教学模式 · 已达到目标音',
    microphone: '教学模式 · 麦克风实时输入'
  };
  ui.session.textContent = phaseLabels[state.phase] || (isRunning ? '教学模式 · 正在分析' : '教学模式 · 等待开始');
  ui.servoStatus.textContent = feedback.tone === 'perfect'
    ? '目标位置已稳定'
    : (analysis.hasSignal ? '舵机缓慢响应中' : '舵机待机');
  ui.deviceStatus.textContent = sourceMode === 'microphone' && isRunning ? '麦克风已连接' : '演示就绪';

  updateColumnStates(analysis);
}

function bindSource(source) {
  if (adapter && adapterListener) adapter.removeEventListener('pitchdata', adapterListener);
  adapter?.disconnect();
  adapter = new UnifiedDataAdapter(source);
  adapterListener = (event) => renderPitchState(event.detail);
  adapter.addEventListener('pitchdata', adapterListener);
  adapter.connect();
}

function stopSources({ keepState = false } = {}) {
  demoSource.stop(false);
  microphoneSource.stop();
  isRunning = false;
  if (!keepState) {
    const target = getTeachingNote(targetIndex);
    renderPitchState({
      ...initialPitchData,
      targetIndex,
      targetNote: target.label,
      targetHz: target.hz,
      source: sourceMode
    });
  }
}

async function startCurrentSource() {
  if (isRunning) {
    stopSources();
    return;
  }

  if (sourceMode === 'demo') {
    demoSource.setTarget(targetIndex);
    demoSource.start();
    return;
  }

  try {
    microphoneSource.setTarget(targetIndex);
    ui.session.textContent = '教学模式 · 正在连接麦克风';
    await microphoneSource.start();
    isRunning = true;
    ui.demoShell.classList.add('is-running');
    showToast('麦克风已连接', '请持续唱出目标音，柱子会缓慢响应。');
  } catch (error) {
    isRunning = false;
    ui.panelMicStatus.textContent = '连接失败';
    showToast('无法使用麦克风', error?.message || '请检查浏览器权限后重试。');
    setSourceMode('demo');
  }
}

function resetExperience() {
  stopSources();
  columnController.reset(targetIndex);
  showToast('已重新开始', '目标音保持不变，可以再次体验。');
}

function setSourceMode(nextMode) {
  if (nextMode === sourceMode) return;
  stopSources();
  sourceMode = nextMode;
  ui.demoSourceButton.classList.toggle('active', sourceMode === 'demo');
  ui.microphoneSourceButton.classList.toggle('active', sourceMode === 'microphone');
  bindSource(sourceMode === 'demo' ? demoSource : microphoneSource);
  showToast(
    sourceMode === 'demo' ? '已切换为模拟演示' : '已切换为麦克风实时',
    sourceMode === 'demo' ? '无需授权，适合比赛现场稳定展示。' : '点击“开始体验”后浏览器将请求麦克风权限。'
  );
}

function showToast(title, message) {
  clearTimeout(toastTimer);
  ui.toastTitle.textContent = title;
  ui.toastMessage.textContent = message;
  ui.toast.classList.add('visible');
  toastTimer = window.setTimeout(() => ui.toast.classList.remove('visible'), 2500);
}

function setupDevicePanel() {
  const setOpen = (open) => {
    ui.devicePanel.classList.toggle('open', open);
    ui.devicePanel.setAttribute('aria-hidden', String(!open));
    ui.deviceButton.setAttribute('aria-expanded', String(open));
  };
  ui.deviceButton.addEventListener('click', () => setOpen(!ui.devicePanel.classList.contains('open')));
  ui.deviceCloseButton.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.devicePanel.classList.contains('open')) setOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (!ui.devicePanel.classList.contains('open')) return;
    if (!ui.devicePanel.contains(event.target) && !ui.deviceButton.contains(event.target)) setOpen(false);
  });
}

async function enterPresentation() {
  document.body.classList.add('presentation-active');
  $('#demo').scrollTop = 0;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
  } catch {
    // Browser fullscreen may be blocked; the fixed presentation canvas still works.
  }
}

async function exitPresentation() {
  document.body.classList.remove('presentation-active');
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // The page-level presentation state has already been restored.
  }
}

function setupVoiceControl() {
  $$('[data-voice]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.voice;
      const label = button.textContent.trim();
      ui.voiceCommand.textContent = `“${label}”`;
      if (action === 'start') {
        ui.voiceAction.textContent = '正在执行：开始检测';
        if (!isRunning) await startCurrentSource();
      } else if (action === 'stop') {
        ui.voiceAction.textContent = '正在执行：停止检测';
        stopSources();
      } else if (action === 'reset') {
        ui.voiceAction.textContent = '正在执行：重新测试';
        resetExperience();
      } else {
        ui.voiceAction.textContent = 'AI 降噪已开启';
        ui.panelNoiseStatus.textContent = '已开启';
        showToast('AI 降噪已开启', '演示界面已同步设备状态。');
      }
    });
  });
}

function setupReveal() {
  const elements = $$('.reveal');
  if (!('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  elements.forEach((element) => observer.observe(element));
}

ui.demoSourceButton.addEventListener('click', () => setSourceMode('demo'));
ui.microphoneSourceButton.addEventListener('click', () => setSourceMode('microphone'));
ui.startButton.addEventListener('click', startCurrentSource);
ui.resetButton.addEventListener('click', resetExperience);
ui.exitPresentation.addEventListener('click', exitPresentation);
$$('[data-presentation]').forEach((button) => button.addEventListener('click', enterPresentation));

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('presentation-active');
});
window.addEventListener('pagehide', () => microphoneSource.stop());
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && document.body.classList.contains('presentation-active')) {
    event.preventDefault();
    startCurrentSource();
  }
  if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) resetExperience();
  if (event.key === 'Escape' && document.body.classList.contains('presentation-active')) exitPresentation();
});

setupDevicePanel();
setupVoiceControl();
setupReveal();
bindSource(demoSource);
selectTarget(targetIndex, { silent: true });
