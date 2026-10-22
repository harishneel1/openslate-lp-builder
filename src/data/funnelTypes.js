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
      // Still 'registration' inside, so saved webinars keep their progress
      { id: 'registration', name: 'Sign-up page', job: "Takes their details, and payment if it's paid. Made from your event details." },
      { id: 'thank-you', name: 'Thank you page', job: 'Confirms their spot and tells them what happens next.' },
    ],
  }
];