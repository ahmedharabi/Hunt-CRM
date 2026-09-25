/** Below this many data points a metric shows a small-sample warning. */
export const MIN_SAMPLE = 5;

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function formatDuration(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)}d`;
}
