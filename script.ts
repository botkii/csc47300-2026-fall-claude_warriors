interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: "assignment" | "exam" | "project" | "reading" | "other";
  course?: string;
  description?: string;
  weight?: string;
}

// Source TypeScript for the Live Server-ready script.js file.
// The browser loads script.js directly; use `tsc script.ts --target ES2020 --outFile script.js`
// after editing this file to regenerate the compiled output.

type EventSeed = CalendarEvent;

// The implementation is intentionally mirrored in script.js so this static project
// needs no bundler or package installation. Copy script.js below this declaration
// or compile the typed implementation when extending the prototype.
const sourceNotes: EventSeed[] = [];
void sourceNotes;
