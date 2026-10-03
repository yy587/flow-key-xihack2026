export const MAX_SERVO_SPEED = 0.72; // normalized travel per second; full travel ≈ 1.4 s
export const SERVO_RESPONSE = 3.4;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class ServoSimulation {
  constructor(count = 15, onUpdate = () => {}) {
    this.current = new Array(count).fill(0.035);
    this.target = new Array(count).fill(0.035);
    this.onUpdate = onUpdate;
    this.frame = 0;
    this.lastTime = performance.now();
    this.running = true;
    this.tick = this.tick.bind(this);
    this.frame = requestAnimationFrame(this.tick);
  }

  setTargets(values) {
    this.target = this.target.map((_, index) => clamp(Number(values[index] ?? 0.035), 0.03, 1));
  }

  setImmediate(values) {
    this.target = this.target.map((_, index) => clamp(Number(values[index] ?? 0.035), 0.03, 1));
    this.current = [...this.target];
    this.onUpdate([...this.current]);
  }

  tick(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    let changed = false;

    this.current = this.current.map((value, index) => {
      const delta = this.target[index] - value;
      if (Math.abs(delta) < 0.0005) return this.target[index];
      const easedStep = delta * (1 - Math.exp(-SERVO_RESPONSE * dt));
      const limitedStep = clamp(easedStep, -MAX_SERVO_SPEED * dt, MAX_SERVO_SPEED * dt);
      changed = true;
      return clamp(value + limitedStep, 0.03, 1);
    });

    if (changed) this.onUpdate([...this.current]);
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}
