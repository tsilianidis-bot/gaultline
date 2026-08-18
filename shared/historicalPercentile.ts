export function formatOrdinal(value: number): string {
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  switch (rounded % 10) {
    case 1: return `${rounded}st`;
    case 2: return `${rounded}nd`;
    case 3: return `${rounded}rd`;
    default: return `${rounded}th`;
  }
}

export function describeHistoricalPercentile(value: number): string {
  const percentile = Math.max(0, Math.min(100, Math.round(value)));
  if (percentile <= 5) return "exceptionally low";
  if (percentile <= 20) return "historically low";
  if (percentile < 40) return "below typical";
  if (percentile <= 60) return "typical";
  if (percentile < 80) return "above typical";
  if (percentile < 95) return "historically elevated";
  return "exceptionally elevated";
}

export function formatHistoricalPercentile(value: number): string {
  return `${formatOrdinal(value)} historical percentile (${describeHistoricalPercentile(value)})`;
}
