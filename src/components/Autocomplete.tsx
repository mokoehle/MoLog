import { useState } from 'react'
import { findExact, matchSuggestions, type Named } from '../logic/search'

interface Props<T extends Named> {
  label: string
  placeholder: string
  items: T[]
  /** Wird angezeigt, solange nichts eingetippt ist (z. B. zuletzt genutzt). */
  initialSuggestions: T[]
  rank?: (item: T) => number
  hint?: (item: T) => string | undefined
  /** Zusätzlicher Suchtext, z. B. der Gruppenname einer Übung */
  extraText?: (item: T) => string | undefined
  onSelect: (item: T) => void
  onCreate: (name: string) => void
  autoFocus?: boolean
}

const MAX_RESULTS = 6

/** Textfeld mit Vorschlägen. Gibt es den Namen noch nicht, kann er direkt angelegt werden. */
export function Autocomplete<T extends Named>(props: Props<T>) {
  const { label, placeholder, items, initialSuggestions, rank, hint, extraText, onSelect, onCreate, autoFocus = true } = props
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const results = trimmed ? matchSuggestions(items, trimmed, rank, extraText) : initialSuggestions
  const exact = trimmed ? findExact(items, trimmed) : undefined

  const submit = () => {
    if (!trimmed) return
    if (exact) onSelect(exact)
    else if (results.length === 1) onSelect(results[0])
    else onCreate(trimmed)
  }

  return (
    <div className="autocomplete">
      <label className="field-label">{label}</label>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          className="text-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
        />
      </form>
      <ul className="suggestions">
        {results.slice(0, MAX_RESULTS).map((item) => (
          <li key={item.id}>
            <button type="button" className="suggestion" onClick={() => onSelect(item)}>
              <span>{item.name}</span>
              {hint?.(item) && <span className="suggestion-hint">{hint(item)}</span>}
            </button>
          </li>
        ))}
        {trimmed && !exact && (
          <li>
            <button type="button" className="suggestion suggestion-create" onClick={() => onCreate(trimmed)}>
              + „{trimmed}“ anlegen
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
