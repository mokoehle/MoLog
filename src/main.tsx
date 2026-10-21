import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { applySettings } from './settings'
import './pwa'
import { trackVisualViewport } from './visualViewport'

applySettings()
trackVisualViewport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
