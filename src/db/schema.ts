/**
 * Datenmodell von MoLog.
 *
 * Bewusst flach und JSON-freundlich gehalten, damit es sich 1:1 exportieren
 * und später in andere Plattformen (z. B. SwiftUI) übernehmen lässt.
 * Alle Zeitstempel sind Unix-Millisekunden (Date.now()).
 */

export type Id = string

/** Ort des Trainings, z. B. ein Gym oder ein Calisthenics-Park. */
export interface Location {
  id: Id
  name: string
  createdAt: number
}

/** Art des Trainings, z. B. Push, Pull, Legs. */
export interface WorkoutType {
  id: Id
  name: string
  createdAt: number
}

/** Was pro Satz gezählt wird. */
export type Measure = 'reps' | 'seconds'

/** Gerät einer Übung – bestimmt u. a. die vorgeschlagene Schrittweite des Gewichts-Sliders. */
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'other'

/**
 * Sammelbegriff für mehrere Übungen, z. B. "Rudern" für T-Bar-Rudern, Kabelrudern, Kurzhantelrudern.
 * Wird nie direkt geloggt, dient zum Sortieren und für Auswertungen über alle Varianten.
 */
export interface ExerciseGroup {
  id: Id
  name: string
  createdAt: number
}

/** Eine konkrete Übung – das, was im Training geloggt wird. */
export interface Exercise {
  id: Id
  name: string
  /** Optional: Gruppe, zu der die Übung gehört. */
  groupId?: Id
  equipment: Equipment
  /** Ob pro Satz ein (Zusatz-)Gewicht erfasst wird. */
  usesWeight: boolean
  /** Schrittweite des Gewichts-Sliders in kg, z. B. 1 bei Kurzhanteln. */
  weightStep: number
  /** Wiederholungen oder Sekunden (Halteübungen). */
  measure: Measure
  createdAt: number
}

/** Eine Trainingseinheit. `endedAt` fehlt, solange sie läuft. */
export interface Workout {
  id: Id
  locationId: Id
  workoutTypeId: Id
  startedAt: number
  endedAt?: number
}

/**
 * Eine Übung innerhalb eines Trainings.
 * startedAt = Übung gewählt, endedAt = "Nächste Übung" bzw. "Training beenden".
 */
export interface ExerciseEntry {
  id: Id
  workoutId: Id
  exerciseId: Id
  /** Reihenfolge innerhalb des Trainings, beginnend bei 0. */
  position: number
  startedAt: number
  endedAt?: number
}

/**
 * Ein Satz. workoutId/exerciseId sind redundant zu entryId mitgespeichert,
 * damit Auswertungen ohne Joins auskommen.
 */
export interface WorkoutSet {
  id: Id
  entryId: Id
  workoutId: Id
  exerciseId: Id
  /** Reihenfolge innerhalb der Übung, beginnend bei 0. */
  position: number
  /** Gewicht bzw. Zusatzgewicht in kg; null, wenn die Übung kein Gewicht nutzt. */
  weightKg: number | null
  /** Wiederholungen; null bei Halteübungen. */
  reps: number | null
  /** Haltedauer in Sekunden; null bei Wiederholungsübungen. */
  durationSec: number | null
  loggedAt: number
}

export const SCHEMA_VERSION = 2

/** Format für Export/Import. */
export interface ExportFile {
  app: 'molog'
  schemaVersion: number
  exportedAt: number
  data: {
    locations: Location[]
    workoutTypes: WorkoutType[]
    exerciseGroups: ExerciseGroup[]
    exercises: Exercise[]
    workouts: Workout[]
    entries: ExerciseEntry[]
    sets: WorkoutSet[]
  }
}
