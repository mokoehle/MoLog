import { useLayoutEffect, useRef, useState } from 'react'
import { fmtDate, fmtNum } from '../logic/format'

export interface Point {
  t: number
  v: number
}

interface Props {
  points: Point[] // chronologisch
  unit: string
}

const H = 180
const PAD = { top: 16, right: 16, bottom: 26, left: 40 }

/** Schöne Achsenwerte (1, 2, 2.5, 5 × 10^n). */
function niceTicks(min: number, max: number, count = 3) {
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return ticks
}

/** Einfaches Liniendiagramm für eine Kennzahl über die Zeit, mit Antippen für Details. */
export function LineChart({ points, unit }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [active, setActive] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const values = points.map((p) => p.v)
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const yMin = ticks[0]
  const yMax = ticks.at(-1)!
  const t0 = points[0].t
  const t1 = points.at(-1)!.t
  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const x = (t: number) => PAD.left + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const showMarkers = points.length <= 24

  const pick = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    const px = clientX - rect.left
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].t) - px) < Math.abs(x(points[best].t) - px)) best = i
    setActive(best)
  }

  const shown = active ?? points.length - 1
  const sp = points[shown]
  const tipX = x(sp.t)
  const tipLeft = Math.min(Math.max(tipX, 60), width - 60)

  return (
    <div
      ref={ref}
      className="chart"
      onPointerDown={(e) => pick(e.clientX)}
      onPointerMove={(e) => e.buttons && pick(e.clientX)}
      onPointerLeave={() => setActive(null)}
    >
      <div className="chart-tip" style={{ left: tipLeft }}>
        <strong>
          {fmtNum(sp.v)} {unit}
        </strong>
        <span>{fmtDate(sp.t)}</span>
      </div>
      <svg width={width} height={H} role="img" aria-label={`Verlauf in ${unit}`}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart-axis" x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
              {fmtNum(v)}
            </text>
          </g>
        ))}
        <text className="chart-axis" x={PAD.left} y={H - 6} textAnchor="start">
          {fmtDate(t0)}
        </text>
        {t1 !== t0 && (
          <text className="chart-axis" x={width - PAD.right} y={H - 6} textAnchor="end">
            {fmtDate(t1)}
          </text>
        )}
        <line className="chart-cursor" x1={tipX} x2={tipX} y1={PAD.top} y2={PAD.top + innerH} />
        <path className="chart-line" d={path} />
        {points.map((p, i) =>
          showMarkers || i === shown ? (
            <circle
              key={p.t}
              className={i === shown ? 'chart-dot active' : 'chart-dot'}
              cx={x(p.t)}
              cy={y(p.v)}
              r={i === shown ? 6 : 4}
            />
          ) : null,
        )}
      </svg>
    </div>
  )
}
