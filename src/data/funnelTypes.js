import { Video, MessagesSquare, GraduationCap, Magnet } from 'lucide-react';

export const funnelTypes = [
  {
    id: 'webinar',
    title: 'Run a Webinar / Workshop',
    description: 'Get people to sign up for a live session, free or paid.',
    icon: Video,
    available: true,
    pages: [
      { id: 'landing', name: 'Landing page', job: 'Convinces visitors your webinar is worth their time.' },
      { id: 'registration', name: 'Registration page', job: "Collects their details, and payment if it's paid." },
      { id: 'thank-you', name: 'Thank you page', job: 'Confirms their spot and tells them what happens next.' },
    ],
  },
  {
    id: 'consulting',
    title: '1:1 Consulting',
    description: 'Let people book a paid call with you.',
    icon: MessagesSquare,
    available: false,
    pages: [
      { id: 'landing', name: 'Landing page', job: 'Explains what the call is and who it helps.' },
      { id: 'booking', name: 'Booking page', job: 'Lets them pick a slot and pay.' },
      { id: 'confirmation', name: 'Confirmation page', job: 'Confirms the booking and next steps.' },
    ],
  },
  {
    id: 'course',
    title: 'Course Sales',
    description: 'Sell a recorded course with a sales page and checkout.',
    icon: GraduationCap,
    available: false,
    pages: [
      { id: 'sales', name: 'Sales page', job: 'Shows what the course covers and why it works.' },
      { id: 'checkout', name: 'Checkout page', job: 'Takes payment.' },
      { id: 'welcome', name: 'Welcome page', job: 'Gets them started with the course.' },
    ],
  },
  {
    id: 'lead-magnet',
    title: 'Lead Magnet',
    description: 'Give away a free resource in exchange for an email.',
    icon: Magnet,
    available: false,
    pages: [
      { id: 'opt-in', name: 'Opt-in page', job: 'Offers the free resource for an email.' },
      { id: 'thank-you', name: 'Thank you page', job: 'Delivers the resource.' },
    ],
  },
];