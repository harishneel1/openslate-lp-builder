import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PreviewPage from './screens/PreviewPage.jsx'

// ?preview=<funnelId> → full-screen preview of that funnel's landing page (new tab).
// Anything else → the Page Builder.
const previewId = new URLSearchParams(window.location.search).get('preview')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {previewId !== null ? <PreviewPage funnelId={previewId} /> : <App />}
  </StrictMode>,
)