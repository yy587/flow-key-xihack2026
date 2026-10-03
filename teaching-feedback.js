export function createTeachingFeedback(analysis, confidence = 0) {
  if (!analysis?.hasSignal) {
    return {
      tone: 'waiting',
      headline: '等待发声',
      message: '选择目标音后开始。系统会告诉你偏差方向与接近程度。',
      confidenceLabel: '等待声音'
    };
  }

  const cents = analysis.centsOffset;
  const absolute = Math.abs(cents);
  const confidenceLabel = `识别置信度 ${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;

  if (absolute <= 5 && analysis.similarity >= 94) {
    return {
      tone: 'perfect',
      headline: '音准准确 ✓',
      message: '已经到达目标音。柱子稳定在目标位置。',
      confidenceLabel
    };
  }

  if (analysis.similarity === 0) {
    return {
      tone: 'far',
      headline: `当前更接近 ${analysis.detected.label}`,
      message: `先把声音移向目标音 ${analysis.target.label}，柱子会显示接近过程。`,
      confidenceLabel
    };
  }

  if (cents < 0) {
    return {
      tone: absolute <= 18 ? 'near' : 'low',
      headline: absolute <= 18 ? '非常接近目标音' : '当前音高略低',
      message: absolute <= 18 ? '再稍微提高一点，就能到达标准音。' : '请缓慢提高声音，观察目标柱继续升高。',
      confidenceLabel
    };
  }

  return {
    tone: absolute <= 18 ? 'near' : 'high',
    headline: absolute <= 18 ? '非常接近目标音' : '当前音高略高',
    message: absolute <= 18 ? '再稍微降低一点，就能到达标准音。' : '请缓慢降低声音，观察目标柱继续升高。',
    confidenceLabel
  };
}
