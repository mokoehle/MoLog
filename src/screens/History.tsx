import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Exercise, Id } from '../db/schema'
import { fmtDuration, fmtMonth, fmtNum, fmtRelative, fmtShortDay, plural } from '../logic/format'
import { loadAll, primaryMetric, workoutTotals, type AllData } from '../logic/stats'

interface Props {
  onBack: () => void
  onOpenWorkout: (id: Id) => void
  onOpenExercise: (id: Id) => void
}

type Tab = 'workouts' | 'exercises'
type ExerciseSort = 'recent' | 'frequent' | 'name'

// Bleibt erhalten, wenn man in eine Detailansicht und wieder zurück geht.
const remembered = { tab: 'workouts' as Tab, typeFilter: null as Id | null, sort: 'recent' as ExerciseSort }

export function History({ onBack, onOpenWorkout, onOpenExercise }: Props) {
  const [tab, setTab] = useState(remembered.tab)
  const data = useLiveQuery(loadAll)

  const switchTab = (t: Tab) => {
    remembered.tab = t
    setTab(t)
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="link-button" onClick={onBack}>
          ‹ Zurück
        </button>
        <span className="topbar-title">Verlauf</span>
      </header>

      <div className="segmented">
        <button className={tab === 'workouts' ? 'active' : ''} onClick={() => switchTab('workouts')}>
          Trainings
        </button>
        <button className={tab === 'exercises' ? 'active' : ''} onClick={() => switchTab('exercises')}>
          Übungen
        </button>
      </div>

      {data &&
        (tab === 'workouts' ? (
          <WorkoutList data={data} onOpen={onOpenWorkout} />
        ) : (
          <ExerciseList data={data} onOpen={onOpenExercise} />
        ))}
    </div>
  )
}

function WorkoutList({ data, onOpen }: { data: AllData; onOpen: (id: Id) => void }) {
  const [typeFilter, setTypeFilter] = useState(remembered.typeFilter)
  const usedTypes = [...new Set(data.workouts.map((w) => w.workoutTypeId))]
    .map((id) => data.types.get(id))
    .filter((t) => !!t)

  const workouts = data.workouts.filter((w) => !typeFilter || w.workoutTypeId === typeFilter)

  // nach Monat gruppieren
  const months: { label: string; items: typeof workouts }[] = []
  for (const w of workouts) {
    const label = fmtMonth(w.startedAt)
    if (months.at(-1)?.label !== label) months.push({ label, items: [] })
    months.at(-1)!.items.push(w)
  }

  const choose = (id: Id | null) => {
    remembered.typeFilter = id
    setTypeFilter(id)
  }

  if (data.workouts.length === 0) return <p className="muted">Noch keine Trainings.</p>

  return (
    <>
      {usedTypes.length > 1 && (
        <div className="filter-chips">
          <button className={!typeFilter ? 'chip active' : 'chip'} onClick={() => choose(null)}>
            Alle
          </button>
          {usedTypes.map((t) => (
            <button key={t.id} className={typeFilter === t.id ? 'chip active' : 'chip'} onClick={() => choose(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {months.map((m) => (
        <section key={m.label} className="month">
          <h2 className="field-label">
            {m.label} · {plural(m.items.length, 'Training', 'Trainings')}
          </h2>
          <ul className="card-list">
            {m.items.map((w) => {
              const totals = workoutTotals(data, w.id)
              const names = totals.entries.map((e) => data.exercises.get(e.exerciseId)?.name).filter(Boolean)
              return (
                <li key={w.id}>
                  <button className="list-card" onClick={() => onOpen(w.id)}>
                    <span className="list-card-top">
                      <strong>{data.types.get(w.workoutTypeId)?.name}</strong>
                      <span className="muted">{fmtShortDay(w.startedAt)}</span>
                    </span>
                    <span className="muted small">
                      {data.locations.get(w.locationId)?.name} · {fmtDuration(w.endedAt! - w.startedAt)} ·{' '}
                      {plural(totals.sets, 'Satz', 'Sätze')}
                    </span>
                    <span className="small clamp">{names.join(' · ')}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

function ExerciseList({ data, onOpen }: { data: AllData; onOpen: (id: Id) => void }) {
  const [sort, setSort] = useState(remembered.sort)

  const info = (ex: Exercise) => {
    const sessions = data.sessionsByExercise.get(ex.id) ?? []
    const last = sessions.at(-1)
    const metric = primaryMetric(ex)
    const best = sessions.length ? Math.max(...sessions.map((s) => metric.value(s.sets))) : null
    return { count: sessions.length, last: last?.workout.startedAt ?? 0, best, unit: metric.unit }
  }

  // Basis-Übungen mit ihren Varianten darunter
  const roots = [...data.exercises.values()].filter((e) => !e.parentId || !data.exercises.has(e.parentId))
  const groupScore = (ex: Exercise) => {
    const all = [ex, ...(data.variants.get(ex.id) ?? [])].map(info)
    if (sort === 'frequent') return -all.reduce((n, i) => n + i.count, 0)
    return -Math.max(...all.map((i) => i.last))
  }
  roots.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'de') : groupScore(a) - groupScore(b)))

  const choose = (s: ExerciseSort) => {
    remembered.sort = s
    setSort(s)
  }

  if (roots.length === 0) return <p className="muted">Noch keine Übungen.</p>

  const row = (ex: Exercise, variant: boolean) => {
    const i = info(ex)
    return (
      <li key={ex.id}>
        <button className={variant ? 'list-card variant' : 'list-card'} onClick={() => onOpen(ex.id)}>
          <span className="list-card-top">
            <strong>{ex.name}</strong>
            {i.best !== null && (
              <span className="muted">
                {fmtNum(i.best)} {i.unit}
              </span>
            )}
          </span>
          <span className="muted small">
            {i.count ? `${plural(i.count, 'Mal', 'Mal')} · zuletzt ${fmtRelative(i.last)}` : 'noch nie gemacht'}
          </span>
        </button>
      </li>
    )
  }

  return (
    <>
      <div className="filter-chips">
        {(
          [
            ['recent', 'Zuletzt'],
            ['frequent', 'Häufigste'],
            ['name', 'A–Z'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={sort === id ? 'chip active' : 'chip'} onClick={() => choose(id)}>
            {label}
          </button>
        ))}
      </div>
      <ul className="card-list">
        {roots.flatMap((ex) => [
          row(ex, false),
          ...(data.variants.get(ex.id) ?? [])
            .sort((a, b) => a.name.localeCompare(b.name, 'de'))
            .map((v) => row(v, true)),
        ])}
      </ul>
    </>
  )
}
