import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PreviewPage from './screens/PreviewPage.jsx'
import MockCreateService from './screens/MockCreateService.jsx'

// ?preview=<funnelId> → full-screen preview of that funnel's landing page (new tab).
// Add &page=thank-you for its thank you page.
// ?mock=create-service → stand-in for the real Create service page (new tab).
// Anything else → the Page Builder.
const params = new URLSearchParams(window.location.search)
const previewId = params.get('preview')
const previewPage = params.get('page') === 'thank-you' ? 'thank-you' : 'landing'
const mockCreate = params.get('mock') === 'create-service'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {mockCreate ? (
      <MockCreateService />
    ) : previewId !== null ? (
      <PreviewPage funnelId={previewId} page={previewPage} />
    ) : (
      <App />
    )}
  </StrictMode>,
)