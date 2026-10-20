import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Exercise, ExerciseGroup, Id } from '../db/schema'
import { fmtDuration, fmtMonth, fmtNum, fmtRelative, fmtShortDay, plural } from '../logic/format'
import { loadAll, primaryMetric, workoutTotals, type AllData } from '../logic/stats'

interface Props {
  onBack: () => void
  onOpenWorkout: (id: Id) => void
  onOpenExercise: (id: Id) => void
  onOpenGroup: (id: Id) => void
}

type Tab = 'workouts' | 'exercises'
type ExerciseSort = 'recent' | 'frequent' | 'name'

// Bleibt erhalten, wenn man in eine Detailansicht und wieder zurück geht.
const remembered = { tab: 'workouts' as Tab, typeFilter: null as Id | null, sort: 'recent' as ExerciseSort }

export function History({ onBack, onOpenWorkout, onOpenExercise, onOpenGroup }: Props) {
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
          <ExerciseList data={data} onOpen={onOpenExercise} onOpenGroup={onOpenGroup} />
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

type ListItem = { kind: 'group'; group: ExerciseGroup; members: Exercise[] } | { kind: 'exercise'; ex: Exercise }

function ExerciseList({
  data,
  onOpen,
  onOpenGroup,
}: {
  data: AllData
  onOpen: (id: Id) => void
  onOpenGroup: (id: Id) => void
}) {
  const [sort, setSort] = useState(remembered.sort)

  const info = (ex: Exercise) => {
    const sessions = data.sessionsByExercise.get(ex.id) ?? []
    const last = sessions.at(-1)
    const metric = primaryMetric(ex)
    const best = sessions.length ? Math.max(...sessions.map((s) => metric.value(s.sets))) : null
    return { count: sessions.length, last: last?.workout.startedAt ?? 0, best, unit: metric.unit }
  }

  // Gruppen (mit ihren Übungen darunter) und Übungen ohne Gruppe in einer Liste
  const items: ListItem[] = [
    ...[...data.groups.values()].map((group) => ({
      kind: 'group' as const,
      group,
      members: data.exercisesByGroup.get(group.id) ?? [],
    })),
    ...[...data.exercises.values()]
      .filter((ex) => !ex.groupId || !data.groups.has(ex.groupId))
      .map((ex) => ({ kind: 'exercise' as const, ex })),
  ]
  const itemName = (i: ListItem) => (i.kind === 'group' ? i.group.name : i.ex.name)
  const score = (i: ListItem) => {
    const all = (i.kind === 'group' ? i.members : [i.ex]).map(info)
    if (sort === 'frequent') return -all.reduce((n, x) => n + x.count, 0)
    return -Math.max(0, ...all.map((x) => x.last))
  }
  items.sort((a, b) => (sort === 'name' ? itemName(a).localeCompare(itemName(b), 'de') : score(a) - score(b)))

  const choose = (s: ExerciseSort) => {
    remembered.sort = s
    setSort(s)
  }

  if (items.length === 0) return <p className="muted">Noch keine Übungen.</p>

  const row = (ex: Exercise, inGroup: boolean) => {
    const i = info(ex)
    return (
      <li key={ex.id}>
        <button className={inGroup ? 'list-card variant' : 'list-card'} onClick={() => onOpen(ex.id)}>
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
        {items.flatMap((item) =>
          item.kind === 'exercise'
            ? [row(item.ex, false)]
            : [
                <li key={item.group.id}>
                  <button className="group-row" onClick={() => onOpenGroup(item.group.id)}>
                    <strong>{item.group.name}</strong>
                    <span className="muted small">{plural(item.members.length, 'Übung', 'Übungen')} ›</span>
                  </button>
                </li>,
                ...item.members.map((ex) => row(ex, true)),
              ],
        )}
      </ul>
    </>
  )
}
