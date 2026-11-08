import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Exercise, ExerciseGroup, Id } from '../db/schema'
import { fmtDuration, fmtMonth, fmtNum, fmtRelative, fmtShortDay, plural } from '../logic/format'
import { loadAll, primaryMetric, workoutTotals, type AllData } from '../logic/stats'
import { createExercise } from '../logic/workout'
import { ExerciseForm } from './ExerciseForm'

interface Props {
  onBack: () => void
  onOpenWorkout: (id: Id) => void
  onOpenExercise: (id: Id) => void
  onOpenGroup: (id: Id) => void
}

type Tab = 'workouts' | 'exercises'
type ExerciseSort = 'recent' | 'frequent' | 'name'

// Bleibt erhalten, wenn man in eine Detailansicht und wieder zurück geht.
const remembered = {
  tab: 'workouts' as Tab,
  typeFilter: null as Id | null,
  sort: 'recent' as ExerciseSort,
}

export function History({ onBack, onOpenWorkout, onOpenExercise, onOpenGroup }: Props) {
  const [tab, setTab] = useState(remembered.tab)
  const [creating, setCreating] = useState(false)
  const data = useLiveQuery(loadAll)

  if (creating) {
    return (
      <ExerciseForm
        initialName=""
        submitLabel="Anlegen"
        onCancel={() => setCreating(false)}
        onSubmit={async (input) => {
          await createExercise(input)
          setCreating(false)
        }}
      />
    )
  }

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
          <ExerciseList data={data} onOpen={onOpenExercise} onOpenGroup={onOpenGroup} onNew={() => setCreating(true)} />
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

/** Für die Suche: Groß-/Kleinschreibung, Akzente und Bindestriche spielen keine Rolle. */
const normalize = (s: string) =>
  s
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-_.\s]+/g, ' ')

type ListItem = { kind: 'group'; group: ExerciseGroup; members: Exercise[] } | { kind: 'exercise'; ex: Exercise }

function ExerciseList({
  data,
  onOpen,
  onOpenGroup,
  onNew,
}: {
  data: AllData
  onOpen: (id: Id) => void
  onOpenGroup: (id: Id) => void
  onNew: () => void
}) {
  const [sort, setSort] = useState(remembered.sort)
  const [query, setQuery] = useState('')

  const info = (ex: Exercise) => {
    const sessions = data.sessionsByExercise.get(ex.id) ?? []
    const last = sessions.at(-1)
    const metric = primaryMetric(ex)
    const best = sessions.length ? Math.max(...sessions.map((s) => metric.value(s.sets))) : null
    return {
      count: sessions.length,
      last: last?.workout.startedAt ?? 0,
      best,
      unit: metric.unit,
    }
  }

  const q = normalize(query.trim())
  const items: ListItem[] = q
    ? // Suche: alle passenden Übungen direkt (auch die in Gruppen), dazu passende Gruppen
      [
        ...[...data.groups.values()]
          .filter((g) => normalize(g.name).includes(q))
          .map((group) => ({
            kind: 'group' as const,
            group,
            members: data.exercisesByGroup.get(group.id) ?? [],
          })),
        ...[...data.exercises.values()]
          .filter((ex) => normalize(ex.name).includes(q))
          .map((ex) => ({ kind: 'exercise' as const, ex })),
      ]
    : // Sonst: Gruppen als eine Karte (antippen öffnet sie), Übungen ohne Gruppe einzeln
      [
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

  const newButton = (
    <button className="button button-secondary" onClick={onNew}>
      + Neue Übung
    </button>
  )

  if (data.exercises.size === 0 && data.groups.size === 0)
    return (
      <>
        <p className="muted">Noch keine Übungen.</p>
        {newButton}
      </>
    )

  const usage = (all: ReturnType<typeof info>[]) => {
    const count = all.reduce((n, x) => n + x.count, 0)
    const last = Math.max(0, ...all.map((x) => x.last))
    return count ? `${plural(count, 'Mal', 'Mal')} · zuletzt ${fmtRelative(last)}` : 'noch nie gemacht'
  }

  const exerciseCard = (ex: Exercise) => {
    const i = info(ex)
    const group = q && ex.groupId ? data.groups.get(ex.groupId) : undefined
    return (
      <li key={ex.id}>
        <button className="list-card" onClick={() => onOpen(ex.id)}>
          <span className="list-card-top">
            <strong>{ex.name}</strong>
            {i.best !== null && (
              <span className="muted">
                {fmtNum(i.best)} {i.unit}
              </span>
            )}
          </span>
          <span className="muted small">
            {group ? `${group.name} · ` : ''}
            {usage([i])}
          </span>
        </button>
      </li>
    )
  }

  const groupCard = (group: ExerciseGroup, members: Exercise[]) => (
    <li key={group.id}>
      <button className="list-card" onClick={() => onOpenGroup(group.id)}>
        <span className="list-card-top">
          <strong>{group.name}</strong>
          <span className="muted">{plural(members.length, 'Übung', 'Übungen')} ›</span>
        </span>
        <span className="muted small">{usage(members.map(info))}</span>
      </button>
    </li>
  )

  return (
    <>
      <input
        className="text-input text-input-small search-input"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        placeholder="Übung suchen"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
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
      {items.length === 0 ? (
        <p className="muted">Keine Übung gefunden.</p>
      ) : (
        <ul className="card-list">
          {items.map((item) =>
            item.kind === 'exercise' ? exerciseCard(item.ex) : groupCard(item.group, item.members),
          )}
        </ul>
      )}
      {newButton}
    </>
  )
}
