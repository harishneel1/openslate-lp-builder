import { formatMoney } from './contractPricing';
import { shortDate } from './batchMembers';
import { accountHandle, offeringUrl } from './myPage';
import { whatsappHref } from '../utils/whatsapp';

// ------------------------------------------------------------
// Messages the coach sends a batch member on WhatsApp. Nothing is sent
// by the product: Remind and Send payment link open a chat with the
// member's number and the message ready, and the coach edits it or sends
// it as it is (a plain wa.me link, utils/whatsapp.js).
//
// Every payment happens on the contract's page, so the link is always
// the batch's own (its join page, BatchPage.jsx), the same one the coach
// shares to get new people. The batch's page knows who someone is from
// the email they joined with, so the message asks them to use it:
//   in the batch, payment due → that payment counts as their next month
//   removed                  → paying brings them back
// and nobody is added twice.
//
// The reminder follows where they are:
//   soon     Hi Ravi 🙏 Your Morning Yoga fee of ₹2,000 is due on 14 Dec.
//            Pay here with your email ravi@example.com: <link>
//   today    … is due today (14 Dec). …
//   late     … was due on 14 Dec. Please pay when you can to keep your place. …
//
// It's written as the coach would, since it goes from their own
// WhatsApp. The fee is the batch's fee now (a new fee applies from each
// member's next payment).
// ------------------------------------------------------------

// The batch's own link: its join page, where every payment is made
export const batchPayHref = (batch) => offeringUrl(accountHandle(), batch.id);

const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'there';

// "Pay here with your email ravi@example.com: <link>" (or just the link,
// for someone with no email saved)
const payLine = (member, batch, lead) =>
  member.email ? `${lead} with your email ${member.email}: ${batchPayHref(batch)}` : `${lead}: ${batchPayHref(batch)}`;

export function renewalMessage(member, batch) {
  const fee = formatMoney(batch.price, 'INR');
  const date = member.renewsOn ? shortDate(member.renewsOn) : '';
  const hi = `Hi ${firstName(member.name)} 🙏`;
  if (member.status === 'overdue' || member.status === 'past-grace') {
    return `${hi} Your ${batch.title} fee of ${fee} was due on ${date}. Please pay when you can to keep your place. ${payLine(member, batch, 'Pay here')}`;
  }
  if (member.status === 'today') {
    return `${hi} Your ${batch.title} fee of ${fee} is due today (${date}). ${payLine(member, batch, 'Pay here')}`;
  }
  return `${hi} Your ${batch.title} fee of ${fee} is due on ${date}. ${payLine(member, batch, 'Pay here')}`;
}

// For a removed member: the batch's link, to come back.
//   Hi Meena 🙏 You can rejoin Morning Yoga for ₹2,000 a month. Pay here with your email meena@example.com: <link>
export function rejoinMessage(member, batch) {
  const fee = formatMoney(batch.price, 'INR');
  return `Hi ${firstName(member.name)} 🙏 You can rejoin ${batch.title} for ${fee} a month. ${payLine(member, batch, 'Pay here')}`;
}

// The member's phone as WhatsApp wants it: '+91 98765 43210'
const phoneOf = (member) =>
  member.phone?.number ? `${member.phone.code ?? '+91'} ${member.phone.number}`.trim() : null;

// The chat links with the message ready, or null when their number can't be used
export function reminderHref(member, batch) {
  const phone = phoneOf(member);
  return phone ? whatsappHref(phone, renewalMessage(member, batch)) : null;
}

export function rejoinHref(member, batch) {
  const phone = phoneOf(member);
  return phone ? whatsappHref(phone, rejoinMessage(member, batch)) : null;
}