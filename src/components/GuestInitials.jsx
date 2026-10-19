import { initials } from '../utils/initials';

// ------------------------------------------------------------
// A guest's initials in a circle, for bookings (there's no photo
// of the person who booked). Styles: .bk-face in BookingsPage.css.
// size: 'md' (36px, on the grid) or 'lg' (48px, next call and drawer)
// ------------------------------------------------------------
export default function GuestInitials({ name, size = 'md' }) {
  return (
    <span className={`bk-face bk-face--${size}`} aria-hidden="true">
      {initials(name) || '?'}
    </span>
  );
}