import { getTeachingNote } from './pitch-mapping.js';

/** Canonical UI contract. Demo, microphone and future hardware sources all emit
 * this shape. The rendering layer never needs to know where data came from. */
export const initialPitchData = Object.freeze({
  targetIndex: 2,
  targetNote: 'Re',
  targetHz: 293.66,
  currentHz: null,
  confidence: 0,
  signalLevel: 0,
  latency: 18,
  phase: 'waiting',
  isRunning: false,
  source: 'demo',
  deviceStatus: '演示就绪',
  microphoneStatus: '等待启用',
  noiseReduction: true,
  columnHeights: null,
  elapsed: 0
});

export class UnifiedDataAdapter extends EventTarget {
  constructor(source) {
    super();
    this.source = source;
    this.state = { ...initialPitchData };
    this.unsubscribe = null;
  }

  connect() {
    this.disconnect();
    this.unsubscribe = this.source.subscribe((payload) => {
      this.state = this.normalize(payload);
      this.dispatchEvent(new CustomEvent('pitchdata', { detail: this.state }));
    });
    return this;
  }

  disconnect() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  normalize(payload = {}) {
    const targetIndex = Number(payload.targetIndex ?? this.state.targetIndex ?? 2);
    const target = getTeachingNote(targetIndex);
    const currentHz = payload.currentHz == null ? null : Number(payload.currentHz);
    return {
      ...initialPitchData,
      ...this.state,
      ...payload,
      targetIndex: target.index,
      targetNote: target.label,
      targetHz: target.hz,
      currentHz: Number.isFinite(currentHz) ? currentHz : null,
      confidence: Math.min(1, Math.max(0, Number(payload.confidence ?? 0))),
      signalLevel: Math.min(1, Math.max(0, Number(payload.signalLevel ?? 0)))
    };
  }
}

export class DemoPitchSource {
  constructor(targetIndex = 2) {
    this.listeners = new Set();
    this.targetIndex = targetIndex;
    this.frame = 0;
    this.startTime = 0;
    this.running = false;
    this.lastPayload = this.waitingState();
  }

  waitingState() {
    const target = getTeachingNote(this.targetIndex);
    return {
      ...initialPitchData,
      targetIndex: target.index,
      targetNote: target.label,
      targetHz: target.hz,
      source: 'demo'
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.lastPayload);
    return () => this.listeners.delete(listener);
  }

  emit(payload) {
    this.lastPayload = payload;
    this.listeners.forEach((listener) => listener(payload));
  }

  setTarget(targetIndex) {
    this.targetIndex = getTeachingNote(targetIndex).index;
    if (!this.running) this.emit(this.waitingState());
  }

  start() {
    this.stop(false);
    this.running = true;
    this.startTime = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      const elapsed = (now - this.startTime) / 1000;
      const payload = this.sample(elapsed);
      this.emit(payload);
      if (elapsed < 11.2) {
        this.frame = requestAnimationFrame(tick);
      } else {
        this.running = false;
        this.emit({ ...payload, phase: 'perfect', isRunning: false, elapsed: 11.2 });
      }
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(emitState = true) {
    this.running = false;
    cancelAnimationFrame(this.frame);
    if (emitState) this.emit(this.waitingState());
  }

  reset() { this.stop(true); }

  sample(time) {
    const target = getTeachingNote(this.targetIndex);
    let cents = null;
    let phase = 'waiting';
    let signalLevel = 0;
    let confidence = 0;

    if (time >= 0.9) {
      signalLevel = Math.min(0.82, 0.28 + (time - 0.9) * 0.18);
      confidence = Math.min(0.98, 0.72 + (time - 0.9) * 0.045);

      if (time < 3.0) {
        phase = 'listening';
        const progress = (time - 0.9) / 2.1;
        cents = -78 + progress * 20 + Math.sin(time * 3.2) * 1.8;
      } else if (time < 8.6) {
        phase = 'adjusting';
        const progress = (time - 3.0) / 5.6;
        const eased = 1 - Math.pow(1 - progress, 1.7);
        cents = -58 + eased * 52 + Math.sin(time * 2.5) * (1.6 - progress);
      } else {
        phase = 'perfect';
        const progress = Math.min(1, (time - 8.6) / 1.5);
        cents = -6 + progress * 5.7 + Math.sin(time * 2) * 0.22;
        signalLevel = 0.7 + Math.sin(time * 1.7) * 0.04;
        confidence = 0.98;
      }
    }

    const currentHz = cents == null ? null : target.hz * Math.pow(2, cents / 1200);
    return {
      ...this.waitingState(),
      currentHz,
      confidence,
      signalLevel,
      phase,
      isRunning: true,
      elapsed: time
    };
  }
}

/** Future hardware source contract.
 * A Serial/WebSocket bridge may emit currentHz, or directly provide the final
 * 15-value columnHeights array in normalized 0..1 units. */
export class HardwarePitchSource {
  constructor() { this.listeners = new Set(); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(hardwarePacket) { this.listeners.forEach((listener) => listener(hardwarePacket)); }
}
