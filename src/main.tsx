import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { applySettings } from './settings'
import './pwa'
import { trackVisualViewport } from './visualViewport'
import { startSync } from './sync/sync'

applySettings()
trackVisualViewport()
startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
