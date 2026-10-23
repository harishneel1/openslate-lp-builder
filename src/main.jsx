import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PreviewPage from './screens/PreviewPage.jsx'
import ContractEditorTab from './screens/ContractEditorTab.jsx'
import ProfilePage from './screens/ProfilePage.jsx'
import BookingPage from './screens/BookingPage.jsx'
import CheckoutPage from './screens/CheckoutPage.jsx'
import BookedPage from './screens/BookedPage.jsx'
import ManageBookingPage from './screens/ManageBookingPage.jsx'
import PageNotFound from './screens/PageNotFound.jsx'
import { accountHandle, savedHandle } from './data/myPage'
import { getMockProfile } from './data/mockProfile'
import { isMyCall } from './data/myProfile'

// ?preview=<funnelId> → full-screen preview of that funnel's landing page (new tab).
// Add &page=thank-you for its thank you page.
// ?mock=create-service → a new contract, in its own tab (ContractEditorTab).
//   Add &service=<id> to change that contract instead.
// ?mock=profile → the creator's public profile page. Add &state=calls-only, new or single,
//   or &source=mine for the creator's own page from their setup answers.
// ?mock=book&service=<id> → a call's booking page. Optional: &state= (as above),
//   &slots=busy or none (mockAvailability.js), &tz=Europe/London (try another time zone).
// ?mock=checkout&service=<id>&time=<UTC instant>&tz=<zone> → checkout (from Continue).
//   Add &taken=1 to see the time having just been taken, &hold=20 to see a 20-second hold run out,
//   or &fail=1 to see the first payment fail.
// &questions=example on checkout shows the example questions (the questions step's preview).
// &preview=1&draft=1 on checkout shows a call still being made (the contract step's preview).
// ?mock=booked → the confirmation page (checkout's Pay goes here with the booking's details;
//   &booking=<id> for the creator's own calls, the booking checkout saved).
// ?mock=manage&booking=<id>&action=cancel or reschedule → the student's side, behind the
//   links in their confirmation email. Leave out action to offer both; &tz=<zone> for another clock.
// /<handle> (e.g. localhost:5173/harishneel) → that creator's page: the one made
//   in setup (saved in this browser), or Meera's at /meerajoshi. Unknown → not found.
// /<handle>/<offering id> (e.g. /harishneel/my-call) → that offering's booking page,
//   the link "Copy link" gives on each call card. Works before there's a page too,
//   under the account's link (accountHandle in myPage.js). Add &tz= as for ?mock=book.
// Anything else → the Page Builder.
const params = new URLSearchParams(window.location.search)
const previewId = params.get('preview')
// &page=signup for its sign-up page, &page=thank-you for its thank you page
const previewPage = ['thank-you', 'signup'].includes(params.get('page')) ? params.get('page') : 'landing'
const mock = params.get('mock')
// The parts of the address after the domain: 'harishneel' and 'my-call' in /harishneel/my-call
const segments = window.location.pathname.split('/').filter(Boolean)
const handle = segments[0]?.toLowerCase() ?? null
const offeringId = segments[1] ? decodeURIComponent(segments[1]) : null

function Root() {
  // A creator's page address, unless a ?mock= screen was asked for
  if (handle && !mock && previewId === null) {
    // Their account's link: the one picked in setup, or their name until then
    const mine = handle === accountHandle()
    if (!mine && handle !== getMockProfile().creator.handle) return <PageNotFound handle={handle} />
    // One offering's own link. It only opens under the handle it belongs to,
    // so /someoneelse/my-call doesn't show this creator's call. Their calls
    // work on their own, like Calendly events, page or no page.
    if (offeringId) {
      if (mine !== isMyCall(offeringId)) return <PageNotFound handle={handle} />
      return <BookingPage serviceId={offeringId} timeZone={params.get('tz')} />
    }
    // The page itself only exists once they've picked its link in setup
    if (mine && !savedHandle()) return <PageNotFound handle={handle} />
    return mine ? <ProfilePage source="mine" /> : <ProfilePage />
  }
  if (mock === 'create-service') return <ContractEditorTab serviceId={params.get('service')} />
  if (mock === 'profile')
    return <ProfilePage state={params.get('state')} source={params.get('source')} live={params.get('live') === '1'} />
  if (mock === 'book')
    return (
      <BookingPage
        serviceId={params.get('service')}
        state={params.get('state')}
        slots={params.get('slots')}
        timeZone={params.get('tz')}
        draft={params.get('draft') === '1'}
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
        preview={params.get('preview')}
        draft={params.get('draft') === '1'}
        fail={params.get('fail')}
        exampleQuestions={params.get('questions') === 'example'}
      />
    )
  if (mock === 'manage')
    return <ManageBookingPage bookingId={params.get('booking')} action={params.get('action')} timeZone={params.get('tz')} />
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
        bookingId={params.get('booking')}
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