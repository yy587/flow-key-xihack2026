import { TEACHING_NOTES, getTeachingNote, normalizeFrequencyToTargetOctave } from './pitch-mapping.js';

const FIRMWARE_SAMPLE_RATE = 16000;
const FIRMWARE_SAMPLE_COUNT = 2048;
const FIRMWARE_MIN_FREQUENCY = 80;
const FIRMWARE_MAX_FREQUENCY = 1000;

export function createChannelMap() {
  return TEACHING_NOTES.map((note) => ({ ...note }));
}

function resampleFirmwareFrame(input, inputSampleRate) {
  const output = new Float32Array(FIRMWARE_SAMPLE_COUNT);
  const step = inputSampleRate / FIRMWARE_SAMPLE_RATE;
  const required = Math.ceil((FIRMWARE_SAMPLE_COUNT - 1) * step) + 1;
  const start = Math.max(0, input.length - required);
  for (let index = 0; index < output.length; index += 1) {
    const sourcePosition = start + index * step;
    const leftIndex = Math.min(input.length - 1, Math.floor(sourcePosition));
    const rightIndex = Math.min(input.length - 1, leftIndex + 1);
    const mix = sourcePosition - leftIndex;
    output[index] = input[leftIndex] * (1 - mix) + input[rightIndex] * mix;
  }
  return output;
}

/** Browser port of the supplied ESP32 pitch detection settings:
 * 16 kHz, 2048 samples, 80–1000 Hz, YIN threshold 0.28. */
export function detectPitchYin(buffer, sampleRate) {
  const frame = sampleRate === FIRMWARE_SAMPLE_RATE && buffer.length === FIRMWARE_SAMPLE_COUNT
    ? buffer
    : resampleFirmwareFrame(buffer, sampleRate);

  let mean = 0;
  for (let index = 0; index < FIRMWARE_SAMPLE_COUNT; index += 1) mean += frame[index];
  mean /= FIRMWARE_SAMPLE_COUNT;

  const samples = new Float32Array(FIRMWARE_SAMPLE_COUNT);
  let energy = 0;
  for (let index = 0; index < FIRMWARE_SAMPLE_COUNT; index += 1) {
    samples[index] = frame[index] - mean;
    energy += samples[index] * samples[index];
  }
  const rms = Math.sqrt(energy / FIRMWARE_SAMPLE_COUNT);
  if (rms < 0.0005) return { frequency: null, confidence: 0, rms };

  const maxLag = Math.floor(FIRMWARE_SAMPLE_RATE / FIRMWARE_MIN_FREQUENCY);
  const span = FIRMWARE_SAMPLE_COUNT - maxLag - 1;
  const difference = new Float32Array(maxLag + 2);
  difference[0] = 1;
  let cumulative = 0;

  for (let lag = 1; lag <= maxLag + 1; lag += 1) {
    let value = 0;
    for (let index = 0; index < span; index += 1) {
      const delta = samples[index] - samples[index + lag];
      value += delta * delta;
    }
    cumulative += value;
    difference[lag] = cumulative > 0 ? value * lag / cumulative : 1;
  }

  let bestLag = 0;
  const minLag = Math.floor(FIRMWARE_SAMPLE_RATE / FIRMWARE_MAX_FREQUENCY);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (difference[lag] < 0.28) {
      while (lag < maxLag && difference[lag + 1] < difference[lag]) lag += 1;
      bestLag = lag;
      break;
    }
  }

  if (bestLag === 0 || difference[bestLag] > 0.35) {
    return { frequency: null, confidence: 0, rms };
  }

  const left = difference[bestLag - 1];
  const middle = difference[bestLag];
  const right = difference[bestLag + 1];
  const denominator = left - 2 * middle + right;
  const offset = Math.abs(denominator) > 1e-6 ? 0.5 * (left - right) / denominator : 0;

  return {
    frequency: FIRMWARE_SAMPLE_RATE / (bestLag + offset),
    confidence: Math.max(0, Math.min(1, 1 - middle)),
    rms
  };
}

export class MicrophonePitchSource {
  constructor(targetIndex = 2) {
    this.listeners = new Set();
    this.targetIndex = targetIndex;
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.buffer = null;
    this.frame = 0;
    this.lastEmit = 0;
    this.startTime = 0;
    this.running = false;
    this.smoothFrequency = null;
    this.frequencyHistory = [];
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(payload) {
    this.listeners.forEach((listener) => listener(payload));
  }

  setTarget(targetIndex) {
    this.targetIndex = getTeachingNote(targetIndex).index;
  }

  async start(deviceId = '') {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持麦克风访问');
    this.stop();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass({ latencyHint: 'interactive' });
    await this.context.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      }
    });

    const input = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0;
    input.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.running = true;
    this.startTime = performance.now();
    this.frequencyHistory = [];
    this.loop(performance.now());

    const track = this.stream.getAudioTracks()[0];
    return {
      label: track?.label || '系统默认麦克风',
      deviceId: track?.getSettings?.().deviceId || deviceId
    };
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== 'closed') this.context.close();
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.smoothFrequency = null;
    this.frequencyHistory = [];
  }

  loop(now) {
    if (!this.running || !this.analyser || !this.context) return;

    if (now - this.lastEmit >= 65) {
      this.analyser.getFloatTimeDomainData(this.buffer);
      const result = detectPitchYin(this.buffer, this.context.sampleRate);
      const target = getTeachingNote(this.targetIndex);
      const latency = Math.max(
        10,
        Math.round(((this.context.baseLatency || 0.012) + (FIRMWARE_SAMPLE_COUNT / FIRMWARE_SAMPLE_RATE)) * 1000)
      );

      if (result.frequency && result.confidence > 0.5) {
        this.frequencyHistory.push(result.frequency);
        if (this.frequencyHistory.length > 7) this.frequencyHistory.shift();
        const sorted = [...this.frequencyHistory].sort((a, b) => a - b);
        const medianFrequency = sorted[Math.floor(sorted.length / 2)];
        this.smoothFrequency = this.smoothFrequency == null
          ? medianFrequency
          : this.smoothFrequency * 0.68 + medianFrequency * 0.32;
        const normalized = normalizeFrequencyToTargetOctave(this.smoothFrequency, target.hz);
        const cents = 1200 * Math.log2(normalized / target.hz);

        this.emit({
          targetIndex: target.index,
          targetNote: target.label,
          targetHz: target.hz,
          currentHz: this.smoothFrequency,
          confidence: result.confidence,
          signalLevel: Math.min(1, result.rms * 7),
          latency,
          phase: Math.abs(cents) <= 5 ? 'perfect' : 'listening',
          isRunning: true,
          source: 'microphone',
          deviceStatus: '浏览器已连接',
          microphoneStatus: '正在聆听',
          elapsed: (now - this.startTime) / 1000
        });
      } else {
        this.emit({
          targetIndex: target.index,
          targetNote: target.label,
          targetHz: target.hz,
          currentHz: null,
          confidence: 0,
          signalLevel: Math.min(1, result.rms * 7),
          latency,
          phase: 'waiting',
          isRunning: true,
          source: 'microphone',
          deviceStatus: '浏览器已连接',
          microphoneStatus: '正在聆听',
          elapsed: (now - this.startTime) / 1000
        });
      }
      this.lastEmit = now;
    }

    this.frame = requestAnimationFrame((time) => this.loop(time));
  }
}
