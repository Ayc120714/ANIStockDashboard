/** Build SVG bar chart geometry for FII/DII cash cards. */
export function buildMarketBarChart(values, activeIndex = null, height = 68) {
  if (!values || values.length < 1) return null;
  const safeVals = values.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  });
  const width = Math.max(160, safeVals.length * 12);
  const maxAbs = Math.max(...safeVals.map(Math.abs), 1);
  const gap = 2;
  const barW = Math.max(4, (width - gap * (values.length - 1)) / values.length);
  const midY = height / 2;
  const maxH = midY - 2;

  const rects = safeVals.map((val, i) => {
    const x = i * (barW + gap);
    const h = (Math.abs(val) / maxAbs) * maxH;
    const y = val >= 0 ? midY - h : midY;
    const fill = val >= 0 ? '#28a745' : '#dc3545';
    const isActive = activeIndex === i;
    return { x, y, w: barW, h, fill, isActive, i };
  });

  return { rects, midY, width, height };
}
