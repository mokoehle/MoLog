/**
 * Datenmodell – dieselben Typen wie in der App (src/db/schema.ts), damit nichts auseinanderläuft.
 * Ein Dataset sind alle (nicht gelöschten) Zeilen eines Benutzers. Woher sie kommen (Supabase,
 * Testdaten, später evtl. ein anderer Speicher), spielt für die Auswertung keine Rolle.
 */
import type {
  Exercise,
  ExerciseEntry,
  ExerciseGroup,
  Id,
  Location,
  Workout,
  WorkoutSet,
  WorkoutType,
} from '../../../src/db/schema.ts'

export type { Exercise, ExerciseEntry, ExerciseGroup, Id, Location, Workout, WorkoutSet, WorkoutType }

export interface Dataset {
  locations: Location[]
  workoutTypes: WorkoutType[]
  exerciseGroups: ExerciseGroup[]
  exercises: Exercise[]
  workouts: Workout[]
  entries: ExerciseEntry[]
  sets: WorkoutSet[]
}

/** Liefert die Daten des angemeldeten Benutzers. */
export type DatasetSource = () => Promise<Dataset>
