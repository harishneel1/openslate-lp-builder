import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PreviewPage from './screens/PreviewPage.jsx'
import MockCreateService from './screens/MockCreateService.jsx'
import ProfilePage from './screens/ProfilePage.jsx'

// ?preview=<funnelId> → full-screen preview of that funnel's landing page (new tab).
// Add &page=thank-you for its thank you page.
// ?mock=create-service → stand-in for the real Create service page (new tab).
// ?mock=profile → the creator's public profile page. Add &state=new or &state=single.
// Anything else → the Page Builder.
const params = new URLSearchParams(window.location.search)
const previewId = params.get('preview')
const previewPage = params.get('page') === 'thank-you' ? 'thank-you' : 'landing'
const mock = params.get('mock')

function Root() {
  if (mock === 'create-service') return <MockCreateService />
  if (mock === 'profile') return <ProfilePage state={params.get('state')} />
  if (previewId !== null) return <PreviewPage funnelId={previewId} page={previewPage} />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)