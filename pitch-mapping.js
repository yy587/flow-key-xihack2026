export const TEACHING_NOTES = Object.freeze([
  { index: 0, label: 'Do',  accidental: '',  scientific: 'C4',  midi: 60, hz: 261.63 },
  { index: 1, label: 'Do♯', accidental: '♯', scientific: 'C♯4', midi: 61, hz: 277.18 },
  { index: 2, label: 'Re',  accidental: '',  scientific: 'D4',  midi: 62, hz: 293.66 },
  { index: 3, label: 'Re♯', accidental: '♯', scientific: 'D♯4', midi: 63, hz: 311.13 },
  { index: 4, label: 'Mi',  accidental: '',  scientific: 'E4',  midi: 64, hz: 329.63 },
  { index: 5, label: 'Fa',  accidental: '',  scientific: 'F4',  midi: 65, hz: 349.23 },
  { index: 6, label: 'Fa♯', accidental: '♯', scientific: 'F♯4', midi: 66, hz: 369.99 },
  { index: 7, label: 'Sol', accidental: '',  scientific: 'G4',  midi: 67, hz: 392.00 },
  { index: 8, label: 'Sol♯',accidental: '♯', scientific: 'G♯4', midi: 68, hz: 415.30 },
  { index: 9, label: 'La',  accidental: '',  scientific: 'A4',  midi: 69, hz: 440.00 },
  { index: 10,label: 'La♯', accidental: '♯', scientific: 'A♯4', midi: 70, hz: 466.16 },
  { index: 11,label: 'Si',  accidental: '',  scientific: 'B4',  midi: 71, hz: 493.88 }
]);

// Three auxiliary columns are deliberately interleaved. They never represent
// extra notes; they only soften the physical contour between nearby notes.
export const COLUMN_LAYOUT = Object.freeze([
  { type: 'note', noteIndex: 0 }, { type: 'note', noteIndex: 1 },
  { type: 'note', noteIndex: 2 }, { type: 'note', noteIndex: 3 },
  { type: 'aux', name: '辅助一' },
  { type: 'note', noteIndex: 4 }, { type: 'note', noteIndex: 5 },
  { type: 'note', noteIndex: 6 }, { type: 'note', noteIndex: 7 },
  { type: 'aux', name: '辅助二' },
  { type: 'note', noteIndex: 8 }, { type: 'note', noteIndex: 9 },
  { type: 'note', noteIndex: 10 }, { type: 'note', noteIndex: 11 },
  { type: 'aux', name: '辅助三' }
]);

const NOTE_TO_COLUMN = new Map();
COLUMN_LAYOUT.forEach((entry, columnIndex) => {
  if (entry.type === 'note') NOTE_TO_COLUMN.set(entry.noteIndex, columnIndex);
});

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getTeachingNote(index) {
  return TEACHING_NOTES[mod(Number(index) || 0, 12)];
}

export function normalizeFrequencyToTargetOctave(currentHz, targetHz) {
  if (!Number.isFinite(currentHz) || currentHz <= 0) return null;
  const shift = Math.round(Math.log2(targetHz / currentHz));
  return currentHz * Math.pow(2, shift);
}

export function analyzePitch(currentHz, targetIndex = 2) {
  const target = getTeachingNote(targetIndex);
  if (!Number.isFinite(currentHz) || currentHz <= 0) {
    return {
      hasSignal: false,
      target,
      detected: null,
      currentHz: null,
      centsOffset: null,
      similarity: 0,
      confidence: 0,
      lower: null,
      upper: null,
      noteWeights: new Array(12).fill(0)
    };
  }

  const midiFloat = 69 + 12 * Math.log2(currentHz / 440);
  const pitchClassPosition = mod(midiFloat, 12);
  const lowerIndex = Math.floor(pitchClassPosition) % 12;
  const fraction = pitchClassPosition - Math.floor(pitchClassPosition);
  const upperIndex = (lowerIndex + 1) % 12;
  const lowerWeight = 1 - fraction;
  const upperWeight = fraction;
  const noteWeights = new Array(12).fill(0);
  noteWeights[lowerIndex] = lowerWeight;
  noteWeights[upperIndex] = Math.max(noteWeights[upperIndex], upperWeight);

  const detectedIndex = fraction < 0.5 ? lowerIndex : upperIndex;
  const normalizedHz = normalizeFrequencyToTargetOctave(currentHz, target.hz);
  const centsOffset = 1200 * Math.log2(normalizedHz / target.hz);
  const similarity = Math.round(clamp(noteWeights[target.index] * 100, 0, 100));

  return {
    hasSignal: true,
    target,
    detected: getTeachingNote(detectedIndex),
    currentHz,
    normalizedHz,
    centsOffset,
    similarity,
    lower: { ...getTeachingNote(lowerIndex), weight: Math.round(lowerWeight * 100) },
    upper: { ...getTeachingNote(upperIndex), weight: Math.round(upperWeight * 100) },
    noteWeights
  };
}

function nearestPrimaryLevels(columnIndex, levels) {
  const left = [];
  const right = [];
  for (let i = columnIndex - 1; i >= 0; i -= 1) {
    if (COLUMN_LAYOUT[i].type === 'note') { left.push(levels[i]); if (left.length === 2) break; }
  }
  for (let i = columnIndex + 1; i < COLUMN_LAYOUT.length; i += 1) {
    if (COLUMN_LAYOUT[i].type === 'note') { right.push(levels[i]); if (right.length === 2) break; }
  }
  return [...left, ...right].filter(Number.isFinite);
}

export function buildColumnTargets(analysis, selectedTargetIndex = 2) {
  const levels = new Array(15).fill(0.035);

  if (!analysis?.hasSignal) {
    const targetColumn = NOTE_TO_COLUMN.get(getTeachingNote(selectedTargetIndex).index);
    if (targetColumn != null) levels[targetColumn] = 0.1;
  } else {
    analysis.noteWeights.forEach((weight, noteIndex) => {
      const columnIndex = NOTE_TO_COLUMN.get(noteIndex);
      if (columnIndex != null) levels[columnIndex] = 0.035 + weight * 0.965;
    });
  }

  COLUMN_LAYOUT.forEach((entry, index) => {
    if (entry.type !== 'aux') return;
    const neighbors = nearestPrimaryLevels(index, levels);
    const peak = Math.max(0, ...neighbors);
    const average = neighbors.reduce((sum, value) => sum + value, 0) / Math.max(1, neighbors.length);
    levels[index] = clamp(0.03 + peak * 0.38 + average * 0.12, 0.03, 0.55);
  });

  return levels;
}

export function noteIndexToColumnIndex(noteIndex) {
  return NOTE_TO_COLUMN.get(mod(noteIndex, 12));
}
