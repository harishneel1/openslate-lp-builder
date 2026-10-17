import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PreviewPage from './screens/PreviewPage.jsx'
import MockCreateService from './screens/MockCreateService.jsx'
import ProfilePage from './screens/ProfilePage.jsx'
import BookingPage from './screens/BookingPage.jsx'
import CheckoutPage from './screens/CheckoutPage.jsx'
import BookedPage from './screens/BookedPage.jsx'
import AvailabilityPage from './screens/AvailabilityPage.jsx'

// ?preview=<funnelId> → full-screen preview of that funnel's landing page (new tab).
// Add &page=thank-you for its thank you page.
// ?mock=create-service → stand-in for the real Create service page (new tab).
// ?mock=profile → the creator's public profile page. Add &state=calls-only, new or single,
//   or &source=mine for the creator's own page from their setup answers.
// ?mock=book&service=<id> → a call's booking page. Optional: &state= (as above),
//   &slots=busy or none (mockAvailability.js), &tz=Europe/London (try another time zone).
// ?mock=checkout&service=<id>&time=<UTC instant>&tz=<zone> → checkout (from Continue).
//   Add &taken=1 to see the time having just been taken, &hold=20 to see a 20-second hold run out,
//   or &fail=1 to see the first payment fail.
// ?mock=booked → the confirmation page (checkout's Pay goes here with the booking's details).
// ?mock=availability → the creator's Availability screen (in the app, under Services).
// Anything else → the Page Builder.
const params = new URLSearchParams(window.location.search)
const previewId = params.get('preview')
const previewPage = params.get('page') === 'thank-you' ? 'thank-you' : 'landing'
const mock = params.get('mock')

function Root() {
  if (mock === 'create-service') return <MockCreateService />
  if (mock === 'profile') return <ProfilePage state={params.get('state')} source={params.get('source')} />
  if (mock === 'book')
    return (
      <BookingPage
        serviceId={params.get('service')}
        state={params.get('state')}
        slots={params.get('slots')}
        timeZone={params.get('tz')}
      />
    )
  if (mock === 'checkout')
    return (
      <CheckoutPage
        serviceId={params.get('service')}
        time={params.get('time')}
        state={params.get('state')}
        slots={params.get('slots')}
        timeZone={params.get('tz')}
        taken={params.get('taken')}
        hold={params.get('hold')}
        fail={params.get('fail')}
      />
    )
  if (mock === 'availability') return <AvailabilityPage />
  if (mock === 'booked')
    return (
      <BookedPage
        serviceId={params.get('service')}
        time={params.get('time')}
        timeZone={params.get('tz')}
        state={params.get('state')}
        name={params.get('name')}
        email={params.get('email')}
        phone={params.get('phone')}
      />
    )
  if (previewId !== null) return <PreviewPage funnelId={previewId} page={previewPage} />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)