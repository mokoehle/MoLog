/** Build-Zeitpunkt – zeigt, ob ein Update angekommen ist. */
export function VersionInfo() {
  const built = new Date(__BUILD_TIME__).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return <p className="muted diag center">Version vom {built}</p>
}
