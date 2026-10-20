import { useEffect, useState } from 'react'

/** Misst, wie hoch ein CSS-Wert auf diesem Gerät wirklich ist (z. B. "100lvh", "env(safe-area-inset-top)"). */
function measure(css: string) {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;top:0;left:-10px;width:1px;visibility:hidden;height:${css}`
  document.body.appendChild(probe)
  const h = probe.getBoundingClientRect().height
  probe.remove()
  return Math.round(h)
}

function read() {
  return {
    standalone: matchMedia('(display-mode: standalone)').matches,
    screen: screen.height,
    inner: innerHeight,
    visual: Math.round(visualViewport?.height ?? 0),
    appH: measure('var(--app-h)'),
    lvh: measure('100lvh'),
    dvh: measure('100dvh'),
    svh: measure('100svh'),
    top: measure('env(safe-area-inset-top)'),
    bottom: measure('env(safe-area-inset-bottom)'),
  }
}

/** Technische Werte zur Fehlersuche (Bildschirmhöhe auf iOS). */
export function ViewportInfo() {
  const [info, setInfo] = useState(read)

  useEffect(() => {
    const update = () => setInfo(read())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const built = new Date(__BUILD_TIME__).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <p className="muted diag">
      Version vom {built}
      <br />
      App: {info.standalone ? 'Home-Bildschirm' : 'Browser'} · Bildschirm {info.screen} · Fenster {info.inner} · sichtbar{' '}
      {info.visual}
      <br />
      app-h {info.appH} · lvh {info.lvh} · dvh {info.dvh} · svh {info.svh} · oben {info.top} · unten {info.bottom}
    </p>
  )
}
