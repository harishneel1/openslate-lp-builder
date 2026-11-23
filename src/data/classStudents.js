import { loadBookings, onBookingsChange } from './bookingsStore';
import { isRemoved, onSignupsChange, peopleOf } from './webinarSignups';
import { contractSignupsOf, isRefunded, onContractSignupsChange } from './contractSignupsStore';
import { getAllServices } from './mockServices';

// ------------------------------------------------------------
// A live class's students: everyone who bought any of its linked
// contracts (batch.contractIds), one each. Someone on two of them shows
// once, with both contracts. The same people course access counts
// (courseAccess.js), with their names and when they joined:
//
//   a 1:1 call's contract   everyone who booked that call, unless the
//                           booking was cancelled (bookingsStore.js)
//   a webinar's contract    everyone who registered, unless they were
//                           removed (webinarSignups.js)
//   any other contract      everyone who signed up on its checkout page,
//                           unless it was refunded (contractSignupsStore.js)
//   sample students         added from Prototype controls on the class's
//                           page, so the list can be tried with people in it
//
// One person, matched by email, else the last 10 digits of their phone.
// In the real product the server works this out.
//
// studentsOf(batch) → [{ id, name, email, phone ('+91 98765 43210' or ''),
//   contracts: [{ id, title }], joinedAt (ms), sample }], newest first
// studentsCsv(students) → a CSV file's text (Excel-ready), for Export
// addSampleStudents(batch), clearSampleStudents(batchId), hasSampleStudents(batchId)
// onStudentsChange(fn) → runs fn when bookings, sign-ups or samples
//   change; returns the function that stops it
// ------------------------------------------------------------

const SAMPLE_KEY = 'pagebuilder:class-sample-students';
const SAMPLES_CHANGED = 'class-sample-students-changed';

const lower = (v) => String(v ?? '').trim().toLowerCase();
const last10 = (v) => String(v?.number ?? v ?? '').replace(/\D/g, '').slice(-10);
// { code, number } or '+91 98765 43210' → '+91 98765 43210'
const phoneText = (v) => (v && typeof v === 'object' ? `${v.code ?? ''} ${v.number ?? ''}`.trim() : String(v ?? '').trim());
const toMs = (v) => (Number.isFinite(v) ? v : Date.parse(v) || 0);

// ---------- Samples ----------

function readSamples() {
  try {
    const list = JSON.parse(localStorage.getItem(SAMPLE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeSamples(list) {
  try {
    localStorage.setItem(SAMPLE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(SAMPLES_CHANGED));
    return true;
  } catch {
    return false;
  }
}

const SAMPLE_NAMES = ['Priya Sharma', 'Arjun Mehta', 'Lakshmi Iyer', 'Rahul Verma', 'Ananya Rao', 'Vikram Nair', 'Meera Pillai', 'Karthik Reddy'];

// A handful of people across the class's contracts; one is on two of them
export function addSampleStudents(batch, now = Date.now()) {
  const ids = batch.contractIds ?? [];
  if (ids.length === 0) return false;
  const made = SAMPLE_NAMES.map((name, i) => {
    const first = name.split(' ')[0].toLowerCase();
    return {
      id: `stu-sample-${now.toString(36)}${i}`,
      batchId: batch.id,
      contractIds: i === 0 && ids.length > 1 ? ids.slice(0, 2) : [ids[i % ids.length]],
      name,
      email: `${first}@example.com`,
      phone: i === 5 ? '' : `+91 98765 ${String(43210 + i * 7).slice(-5)}`,
      joinedAt: now - (i + 1) * 26 * 3_600_000,
    };
  });
  return writeSamples([...readSamples(), ...made]);
}

export const hasSampleStudents = (batchId) => readSamples().some((s) => s.batchId === batchId);
export const clearSampleStudents = (batchId) => writeSamples(readSamples().filter((s) => s.batchId !== batchId));

// ---------- Who holds one contract ----------

function holdersOf(contract) {
  if (contract.callId) {
    return loadBookings()
      .filter((b) => b.serviceId === contract.callId && b.status !== 'cancelled')
      .map((b) => ({ name: b.guest?.name, email: b.guest?.email, phone: b.guest?.phone, at: toMs(b.createdAt ?? b.start) }));
  }
  if (contract.webinarId) {
    return peopleOf(contract.webinarId)
      .filter((p) => !isRemoved(p))
      .map((p) => ({ name: p.name, email: p.email, phone: p.phone, at: toMs(p.registeredAt) }));
  }
  return contractSignupsOf(contract.id)
    .filter((r) => !isRefunded(r))
    .map((r) => ({ name: r.name, email: r.email, phone: r.phone, at: toMs(r.createdAt) }));
}

// ---------- A class's students ----------

export function studentsOf(batch) {
  const ids = batch.contractIds ?? [];
  if (ids.length === 0) return [];
  const contracts = new Map(getAllServices().map((c) => [c.id, c]));
  const people = new Map(); // key → student
  const add = (h, contract, sample = false) => {
    const email = lower(h.email);
    const phone = last10(h.phone);
    const key = email ? `e:${email}` : phone.length === 10 ? `p:${phone}` : null;
    if (!key) return;
    const found = people.get(key);
    const tag = { id: contract.id, title: contract.title };
    if (found) {
      if (!found.contracts.some((c) => c.id === contract.id)) found.contracts.push(tag);
      found.joinedAt = Math.min(found.joinedAt, h.at || found.joinedAt);
      if (!found.name && h.name) found.name = String(h.name).trim();
      if (!found.phone && h.phone) found.phone = phoneText(h.phone);
      return;
    }
    people.set(key, {
      id: key,
      name: String(h.name ?? '').trim(),
      email: String(h.email ?? '').trim(),
      phone: phoneText(h.phone),
      contracts: [tag],
      joinedAt: h.at || 0,
      sample,
    });
  };

  ids.forEach((id) => {
    const contract = contracts.get(id);
    if (!contract) return; // deleted since it was linked
    holdersOf(contract).forEach((h) => add(h, contract));
  });
  readSamples()
    .filter((s) => s.batchId === batch.id)
    .forEach((s) =>
      s.contractIds.forEach((id) => {
        const contract = contracts.get(id);
        if (contract && ids.includes(id)) add({ ...s, at: s.joinedAt }, contract, true);
      }),
    );

  return [...people.values()].sort((a, b) => b.joinedAt - a.joinedAt);
}

// ---------- Export ----------

// One row per student, as a CSV file that Excel opens. The first
// character (a byte-order mark) makes Excel read non-English names.
export function studentsCsv(students) {
  const cell = (v) => {
    const text = String(v ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const when = (ms) => (ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const head = ['Name', 'Email', 'Phone', 'Contracts', 'Joined'];
  const rows = students.map((s) => [s.name, s.email, s.phone, s.contracts.map((c) => c.title).join('; '), when(s.joinedAt)]);
  return `﻿${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

// ---------- Changes ----------

export function onStudentsChange(fn) {
  const stops = [onBookingsChange(fn), onSignupsChange(fn), onContractSignupsChange(fn)];
  const onStorage = (e) => e.key === SAMPLE_KEY && fn();
  window.addEventListener(SAMPLES_CHANGED, fn);
  window.addEventListener('storage', onStorage);
  return () => {
    stops.forEach((stop) => stop());
    window.removeEventListener(SAMPLES_CHANGED, fn);
    window.removeEventListener('storage', onStorage);
  };
}
