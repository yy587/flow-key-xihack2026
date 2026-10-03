import { buildColumnTargets } from './pitch-mapping.js';
import { ServoSimulation } from './servo-simulation.js';

/** The UI consumes only the final 15-value columnHeights array.
 * Real Serial/WebSocket/ESP32 data can call setHardwareHeights directly. */
export class ColumnController extends EventTarget {
  constructor(selectedTargetIndex = 2) {
    super();
    this.selectedTargetIndex = selectedTargetIndex;
    this.columnHeights = new Array(15).fill(0.035);
    this.simulator = new ServoSimulation(15, (heights) => {
      this.columnHeights = heights;
      this.dispatchEvent(new CustomEvent('columns', { detail: { columnHeights: [...heights] } }));
    });
    this.reset(selectedTargetIndex, true);
  }

  setTarget(index) {
    this.selectedTargetIndex = index;
    this.reset(index);
  }

  setPitchAnalysis(analysis) {
    this.simulator.setTargets(buildColumnTargets(analysis, this.selectedTargetIndex));
  }

  setHardwareHeights(columnHeights) {
    if (!Array.isArray(columnHeights) || columnHeights.length !== 15) return;
    this.simulator.setTargets(columnHeights);
  }

  reset(targetIndex = this.selectedTargetIndex, immediate = false) {
    this.selectedTargetIndex = targetIndex;
    const targets = buildColumnTargets(null, targetIndex);
    if (immediate) this.simulator.setImmediate(targets);
    else this.simulator.setTargets(targets);
  }
}
