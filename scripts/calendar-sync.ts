// ─── TYPES ──────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
}

export interface ReminderSettings {
  leadMinutes: number;
  pushEnabled: boolean;
  emailEnabled: boolean;
  email: string;
}

const defaultSettings: ReminderSettings = {
  leadMinutes: 30,
  pushEnabled: false,
  emailEnabled: false,
  email: '',
};

// ─── DATE HELPERS ───────────────────────────────────────────────────
const pad = (n: number): string => String(n).padStart(2, '0');
const icsDate = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

// ─── .ICS EXPORT ────────────────────────────────────────────────────
const escICS = (s: string | undefined): string =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let out = '', pos = 0, limit = 75;
  while (pos < line.length) {
    out += (pos === 0 ? '' : '\r\n ') + line.slice(pos, pos + limit);
    pos += limit;
    limit = 74;
  }
  return out;
}

export function buildICS(events: CalendarEvent[], leadMinutes: number): string {
  const lead = Number(leadMinutes) || 0;
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudentHub//Calendar Sync//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Student Events',
  ];

  for (const ev of events) {
    const start = new Date(ev.start);
    const end = new Date(ev.end || ev.start);
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@studenthub.local`, `DTSTAMP:${icsDate(new Date())}`);
    lines.push(`DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${escICS(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escICS(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escICS(ev.notes)}`);
    lines.push('STATUS:CONFIRMED');

    if (lead > 0) {
      lines.push('BEGIN:VALARM', `TRIGGER:-PT${lead}M`, 'ACTION:DISPLAY', `DESCRIPTION:${escICS(`Reminder: ${ev.title}`)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function downloadICS(events: CalendarEvent[], leadMinutes: number, filename = 'events.ics'): void {
  const blob = new Blob([buildICS(events, leadMinutes)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ─── GOOGLE CALENDAR ────────────────────────────────────────────────
export function googleCalendarUrl(ev: CalendarEvent): string {
  const start = new Date(ev.start);
  const end = new Date(ev.end || ev.start);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${icsDate(start)}/${icsDate(end)}`,
    details: ev.notes ?? '',
    location: ev.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─── REMINDERS ──────────────────────────────────────────────────────
let timers: number[] = [];
export function clearScheduledReminders(): void {
  timers.forEach(clearTimeout);
  timers = [];
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export function schedulePushReminders(events: CalendarEvent[], settings: ReminderSettings): number {
  clearScheduledReminders();
  if (!settings.pushEnabled || !('Notification' in window) || Notification.permission !== 'granted' || settings.leadMinutes <= 0) return 0;

  const leadMs = settings.leadMinutes * 60_000;
  const now = Date.now();
  let count = 0;

  for (const ev of events) {
    const delay = new Date(ev.start).getTime() - leadMs - now;
    if (delay > 0 && delay < 24 * 3_600_000) {
      const id = window.setTimeout(() => {
        try {
          new Notification(`Upcoming: ${ev.title}`, {
            body: new Date(ev.start).toLocaleString() + (ev.location ? ` · ${ev.location}` : ''),
            tag: ev.id,
          });
        } catch { /* ignore */ }
      }, delay);
      timers.push(id);
      count++;
    }
  }
  return count;
}

// ─── UI MOUNT & INITIALIZATION ──────────────────────────────────────
export function mountCalendarSync(root: HTMLElement, initialEvents: CalendarEvent[]): void {
  let events = initialEvents;
  let settings: ReminderSettings = { ...defaultSettings };

  try {
    const saved = localStorage.getItem('calendar-sync-reminders');
    if (saved) settings = { ...settings, ...JSON.parse(saved) };
  } catch { /* ignore */ }

  root.innerHTML = `
    <div class="calendar-sync-panel">
      <h3>📅 Calendar Sync</h3>
      <div class="cs-row"><label for="cs-lead">Remind me before:</label><select id="cs-lead"></select></div>
      <div class="cs-row"><label><input type="checkbox" id="cs-push" /> Push notifications</label></div>
      <div class="cs-row"><label><input type="checkbox" id="cs-email" /> Email reminders</label><input type="email" id="cs-email-input" placeholder="you@school.edu" /></div>
      <div class="cs-actions"><button id="cs-export" type="button">⬇ Export .ics</button><button id="cs-google" type="button">📅 Add to Google Calendar</button></div>
      <p id="cs-status" class="cs-status"></p>
    </div>
  `;

  const $ = <T extends HTMLElement>(id: string): T => root.querySelector(`#${id}`) as T;
  const leadSel = $<HTMLSelectElement>('cs-lead');
  const pushTog = $<HTMLInputElement>('cs-push');
  const emailTog = $<HTMLInputElement>('cs-email');
  const emailInput = $<HTMLInputElement>('cs-email-input');
  const statusEl = $<HTMLParagraphElement>('cs-status');

  [0, 10, 30, 60, 120, 1440].forEach((m) => {
    const opt = document.createElement('option');
    opt.value = String(m);
    opt.textContent = m === 0 ? 'No reminder' : m === 60 ? '1 hour' : m === 1440 ? '1 day' : `${m} min`;
    leadSel.appendChild(opt);
  });

  leadSel.value = String(settings.leadMinutes);
  pushTog.checked = settings.pushEnabled;
  emailTog.checked = settings.emailEnabled;
  emailInput.value = settings.email;
  emailInput.disabled = !settings.emailEnabled;

  function save(): void {
    try { localStorage.setItem('calendar-sync-reminders', JSON.stringify(settings)); } catch { /* ignore */ }
    const scheduled = schedulePushReminders(events, settings);
    const pushMsg = settings.pushEnabled ? `Push: <b>${scheduled}</b> reminder(s) scheduled.` : 'Push reminders are off.';
    const emailMsg = settings.emailEnabled ? ` Email preference saved for <b>${settings.email || '—'}</b>.` : '';
    statusEl.innerHTML = pushMsg + emailMsg;
  }

  leadSel.addEventListener('change', () => { settings.leadMinutes = Number(leadSel.value) || 0; save(); });
  pushTog.addEventListener('change', async () => {
    if (!pushTog.checked) { settings.pushEnabled = false; save(); return; }
    const perm = await requestPushPermission();
    if (perm !== 'granted') { pushTog.checked = false; settings.pushEnabled = false; statusEl.textContent = '❌ Notification permission denied.'; return; }
    settings.pushEnabled = true; save();
  });
  emailTog.addEventListener('change', () => { settings.emailEnabled = emailTog.checked; emailInput.disabled = !settings.emailEnabled; save(); });
  emailInput.addEventListener('input', () => {
    settings.email = emailInput.value.trim();
    if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
      emailInput.style.borderColor = '#d93025';
      statusEl.innerHTML = '⚠️ Please enter a valid email address.';
    } else {
      emailInput.style.borderColor = '#ccc';
      save();
    }
  });

  $<HTMLButtonElement>('cs-export').addEventListener('click', () => {
    if (!events.length) { statusEl.textContent = 'No events to export.'; return; }
    downloadICS(events, settings.leadMinutes, 'student-calendar.ics');
    statusEl.textContent = `✅ Exported ${events.length} event(s) as .ics`;
  });

  $<HTMLButtonElement>('cs-google').addEventListener('click', () => {
    if (!events.length) { statusEl.textContent = 'No events to open in Google Calendar.'; return; }
    events.forEach((ev, i) => {
      setTimeout(() => window.open(googleCalendarUrl(ev), '_blank', 'noopener,noreferrer'), i * 250);
    });
    statusEl.textContent = `✅ Opened ${events.length} Google Calendar template(s).`;
  });

  save();
}

// ─── AUTO-INITIALIZATION ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('calendar-sync-container');
  if (!container) return;

  const myEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'CS 310 — Midterm Review',
      start: '2026-10-21T14:00',
      end: '2026-10-21T15:30',
      location: 'Library, Room 204',
      notes: 'Bring practice problems.',
    },
    {
      id: '2',
      title: 'Study Group: Organic Chemistry',
      start: '2026-10-23T18:00',
      end: '2026-10-23T19:30',
      location: 'Student Union',
    },
  ];

  mountCalendarSync(container, myEvents);
});