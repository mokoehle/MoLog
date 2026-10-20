import { useEffect, useRef } from 'react'

const EDGE_PX = 24
const MIN_DISTANCE = 70

/** iOS-artige Zurück-Geste: vom linken Bildschirmrand nach rechts wischen. */
export function useEdgeSwipeBack(enabled: boolean, onBack: () => void) {
  const cb = useRef(onBack)
  cb.current = onBack

  useEffect(() => {
    if (!enabled) return
    let start: { x: number; y: number } | null = null

    const down = (e: TouchEvent) => {
      const t = e.touches[0]
      start = t.clientX <= EDGE_PX ? { x: t.clientX, y: t.clientY } : null
    }
    const up = (e: TouchEvent) => {
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = Math.abs(t.clientY - start.y)
      start = null
      if (dx > MIN_DISTANCE && dy < dx / 2) cb.current()
    }

    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchend', up, { passive: true })
    return () => {
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchend', up)
    }
  }, [enabled])
}
