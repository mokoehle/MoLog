import type { Equipment } from '../db/schema'

export const EQUIPMENT: { id: Equipment; label: string; step: number; usesWeight: boolean }[] = [
  { id: 'barbell', label: 'Langhantel', step: 2.5, usesWeight: true },
  { id: 'dumbbell', label: 'Kurzhantel', step: 1, usesWeight: true },
  { id: 'cable', label: 'Kabel', step: 5, usesWeight: true },
  { id: 'machine', label: 'Maschine', step: 5, usesWeight: true },
  { id: 'bodyweight', label: 'Körpergewicht', step: 2.5, usesWeight: false },
  { id: 'other', label: 'Sonstiges', step: 2.5, usesWeight: true },
]

export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5]

export const equipmentInfo = (id: Equipment) => EQUIPMENT.find((e) => e.id === id) ?? EQUIPMENT.at(-1)!

/**
 * Bei Maschinen und Kabelzügen hängt das Gewicht vom konkreten Gerät ab (Hebel, Umlenkrollen) –
 * Werte aus verschiedenen Gyms sind nicht vergleichbar. Bei Hanteln sind 20 kg überall 20 kg.
 */
export const dependsOnLocation = (equipment: Equipment) => equipment === 'machine' || equipment === 'cable'
