import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Global styles. Several page stylesheets are shared by screens that never
// import them (e.g. the auth pages rely on styles/auth.css), so they're
// loaded app-wide here rather than with individual lazily-loaded pages.
import './index.css'
import 'leaflet/dist/leaflet.css'
import 'react-datepicker/dist/react-datepicker.css'
import './styles/auth.css'
import './styles/calendar.css'
import './pages/app/Explore.css'
import './pages/app/Messages.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
