// WHY page consistency (2026-10-14): the causal headline and the "primary driver"
// sentence use the same scores and ordering as the Top contributors panel.
export interface WhyFamilyLike {
  name: string;
  strength: number;
  signal?: string;
}

const fmt = (n: number) => `${Math.round(n)}/100`;

export function sortWhyFamilies<T extends WhyFamilyLike>(families: readonly T[]): T[] {
  return [...families].filter(f => Number.isFinite(f.strength)).sort((a, b) => b.strength - a.strength);
}

/** Headline naming the top contributors with the exact scores shown in Top contributors. */
export function buildWhyHeadline(families: readonly WhyFamilyLike[]): string | null {
  const top = sortWhyFamilies(families).slice(0, 3);
  if (top.length === 0) return null;
  const parts = top.map(f => `${f.name} (${fmt(f.strength)})`);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `The largest contributors to current pressure are ${list}.`;
}

const PRIMARY_DRIVER_SENTENCE = /\s*The primary verified pressure driver among available evidence is [^.]*\./;

/** Rewrite the narrative's primary-driver sentence so it names the top contributor. */
export function alignPrimaryDriver(story: string, families: readonly WhyFamilyLike[]): string {
  const top = sortWhyFamilies(families)[0];
  if (!top || !PRIMARY_DRIVER_SENTENCE.test(story)) return story;
  const signal = top.signal ? `, which is signaling ${top.signal} conditions` : "";
  return story.replace(PRIMARY_DRIVER_SENTENCE, ` The primary pressure driver is ${top.name} (${fmt(top.strength)})${signal}.`);
}
