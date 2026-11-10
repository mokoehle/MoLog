/**
 * Körperregion einer Übung. MoLog speichert (noch) keine Muskelgruppen – bis dahin wird die Region
 * aus dem Namen der Übung bzw. ihrer Gruppe geschätzt. Reihenfolge der Regeln ist wichtig
 * (z. B. "Beinheben" ist Rumpf, "Beincurl" Beine, "Bizepscurl" Zug).
 */

export type Region = 'legs' | 'push' | 'pull' | 'core' | 'other'

const RULES: [Region, RegExp][] = [
  [
    'core',
    /beinheben|knieheben|leg ?raise|knee ?raise|plank|unterarmstuetz|crunch|sit.?up|bauch|\bcore\b|hollow|l.?sit|dragon ?flag|russian ?twist|ab.?roll|\babs?\b|pallof|seitstuetz|front ?lever|\bfl\b|v.?up/,
  ],
  [
    'legs',
    /kniebeuge|squat|beinpresse|leg ?press|ausfallschritt|lunge|bulgar|kreuzheben|deadlift|\brdl\b|rumaen|beinstreck|leg ?ext|beinbeug|leg ?curl|hamstring|wade|calf|hip ?thrust|glute|gesaess|step.?up|aufsteig|adduk|abduk|adduct|abduct|nordic|pistol|sissy|good ?morning|hackenschmidt|hack ?squat|box ?jump|\bbein/,
  ],
  [
    'pull',
    /ruder|row|klimmz|pull|\bchin|\blat\b|latzug|lat ?pull|lats\b|curl|bizeps|bicep|face ?pull|shrug|reverse ?fly|hyper ?ext|rueckenstreck|back ?ext/,
  ],
  [
    'push',
    /bank|bench|druecken|press|dip|liegestuetz|push|fly|butterfly|flys|seitheben|\blateral|frontheben|trizeps|tricep|french|skull|handstand|schulter|shoulder|overhead|muscle.?up/,
  ],
]

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[-_()]/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Region aus Übungs- und Gruppenname */
export function regionOf(...names: (string | undefined)[]): Region {
  const text = normalize(names.filter(Boolean).join(' '))
  for (const [region, re] of RULES) if (re.test(text)) return region
  return 'other'
}

/** Trainingsart, die nach Beintag klingt (Legs, Beine, Unterkörper …) */
export const isLegDayName = (name?: string) => !!name && /\bleg|bein|unterkoerper|lower/.test(normalize(name))
