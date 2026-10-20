export interface Named {
  id: string
  name: string
}

/** Kleinschreibung, ohne Akzente; ß/Umlaute werden vereinheitlicht. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Sortiert passende Einträge: Anfang des Namens > Anfang eines Wortes > irgendwo enthalten > Zusatztext.
 * Bei Gleichstand gewinnt der zuletzt/häufiger genutzte Eintrag (`rank`, kleiner = besser).
 */
export function matchSuggestions<T extends Named>(
  items: T[],
  query: string,
  rank: (item: T) => number = () => 0,
  /** Weiterer Text, der gefunden werden darf (z. B. Gruppenname) – zählt schwächer als der Name. */
  extraText?: (item: T) => string | undefined,
): T[] {
  const q = normalize(query)
  if (!q) return []
  const scored: { item: T; score: number }[] = []
  for (const item of items) {
    const n = normalize(item.name)
    let score: number
    if (n.startsWith(q)) score = 0
    else if (n.split(/[\s-]/).some((w) => w.startsWith(q))) score = 1
    else if (n.includes(q)) score = 2
    else if (extraText && normalize(extraText(item) ?? '').split(/[\s-]/).some((w) => w.startsWith(q))) score = 3
    else continue
    scored.push({ item, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || rank(a.item) - rank(b.item))
    .map((s) => s.item)
}

export function findExact<T extends Named>(items: T[], query: string): T | undefined {
  const q = normalize(query)
  return items.find((i) => normalize(i.name) === q)
}
