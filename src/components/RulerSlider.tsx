import { useEffect, useRef, useState } from 'react'
import { haptic } from '../haptics'

interface Props {
  value: number
  onChange: (v: number) => void
  step: number
  min: number
  max: number
  unit: string
  /** Jeder n-te Strich (in Schritten) wird etwas länger dargestellt, zur Orientierung. */
  majorEvery: number
}

/** Abstand zwischen zwei Strichen in px. */
const PX_PER_STEP = 16
/** Wie viele Striche links und rechts der Mitte gezeichnet werden. */
const VISIBLE = 14
/** Bewegung unter dieser Schwelle (px) zählt als Tipp statt als Wischen. */
const TAP_SLOP = 6
const FRICTION = 0.9
/** Finger länger als das (ms) stillgehalten → kein Nachrollen. */
const HOLD_MS = 80

const fmt = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2 })

/**
 * Lineal-Slider wie im iOS-Timer: Markierung in der Mitte steht fest, die Skala wandert.
 * Wischen nach links erhöht den Wert. Ein Tipp links/rechts ändert ihn um genau einen Schritt.
 */
export function RulerSlider({ value, onChange, step, min, max, unit, majorEvery }: Props) {
  // Position in Schritten (kann während des Ziehens zwischen zwei Strichen liegen).
  const [pos, setPos] = useState(value / step)
  const drag = useRef<{ startX: number; startPos: number; lastX: number; lastT: number; v: number; moved: boolean } | null>(null)
  const anim = useRef<number | null>(null)
  const lastStep = useRef(Math.round(value / step))

  const minPos = min / step
  const maxPos = max / step
  const clamp = (p: number) => Math.min(maxPos, Math.max(minPos, p))

  // Wert von außen geändert (z. B. neue Übung) → Skala nachziehen.
  useEffect(() => {
    if (!drag.current && anim.current === null) {
      // Wert passt nicht zur Schrittweite (z. B. 22,5 kg bei 1-kg-Schritten) → auf nächsten Strich einrasten,
      // damit angezeigter und gespeicherter Wert immer übereinstimmen.
      const snapped = Math.min(max, Math.max(min, Math.round(value / step) * step))
      if (Math.abs(snapped - value) > 1e-9) onChange(Number(snapped.toFixed(4)))
      setPos(snapped / step)
      lastStep.current = Math.round(snapped / step)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, step])

  useEffect(() => () => stopAnim(), [])

  const stopAnim = () => {
    if (anim.current !== null) cancelAnimationFrame(anim.current)
    anim.current = null
  }

  // Bei jedem überfahrenen Strich ein Haptik-Tick
  const tickIfMoved = (s: number) => {
    if (s !== lastStep.current) {
      lastStep.current = s
      haptic()
    }
  }

  const apply = (p: number) => {
    const c = clamp(p)
    setPos(c)
    const s = Math.round(c)
    tickIfMoved(s)
    if (s * step !== value) onChange(Number((s * step).toFixed(4)))
    return c
  }

  const settle = (p: number) => {
    const snapped = Math.round(clamp(p))
    setPos(snapped)
    tickIfMoved(snapped)
    onChange(Number((snapped * step).toFixed(4)))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    stopAnim()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // nicht kritisch
    }
    drag.current = { startX: e.clientX, startPos: pos, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientX - d.startX) > TAP_SLOP) d.moved = true
    if (!d.moved) return
    const dt = Math.max(1, e.timeStamp - d.lastT)
    // Geschwindigkeit in Schritten pro ms, leicht geglättet
    d.v = 0.7 * ((d.lastX - e.clientX) / PX_PER_STEP / dt) + 0.3 * d.v
    d.lastX = e.clientX
    d.lastT = e.timeStamp
    apply(d.startPos + (d.startX - e.clientX) / PX_PER_STEP)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return

    if (!d.moved) {
      // Tipp: links der Mitte −1, rechts +1
      const rect = e.currentTarget.getBoundingClientRect()
      settle(Math.round(pos) + (e.clientX < rect.left + rect.width / 2 ? -1 : 1))
      return
    }

    // Schwung ausrollen lassen, dann auf den nächsten Strich einrasten.
    const held = e.timeStamp - d.lastT > HOLD_MS
    let v = held ? 0 : d.v * 10 // Schritte pro Frame (gedämpft)
    let p = pos
    const tick = () => {
      v *= FRICTION
      p = apply(p + v)
      if (Math.abs(v) < 0.05 || p <= minPos || p >= maxPos) {
        anim.current = null
        settle(p)
        return
      }
      anim.current = requestAnimationFrame(tick)
    }
    if (Math.abs(v) > 0.1) anim.current = requestAnimationFrame(tick)
    else settle(p)
  }

  const base = Math.floor(pos)
  const ticks = []
  for (let i = -VISIBLE; i <= VISIBLE + 1; i++) {
    const k = base + i
    if (k < minPos || k > maxPos) continue
    const offset = (k - pos) * PX_PER_STEP
    const major = k % majorEvery === 0
    ticks.push(
      <span key={k} className={major ? 'ruler-tick major' : 'ruler-tick'} style={{ transform: `translateX(${offset}px)` }} />,
    )
  }

  return (
    <div className="ruler">
      <div className="ruler-value">
        {fmt(Math.round(pos) * step)}
        <span className="ruler-unit">{unit}</span>
      </div>
      <div
        className="ruler-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {ticks}
        <span className="ruler-marker" />
      </div>
    </div>
  )
}
