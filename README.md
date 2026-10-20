# csc47300-2026-fall-claude_warriors
Group for CSC47300

#Course Flow

## Tech Stack
* **Frontend:** React, Tailwind
* **Backend:** Node.js/Flask
* **Database:** Supabase

## Core Features & Team Assignments
### Responsibilities are flexible and could change over the course of the semester.

* **Feature 1: Syllabus Upload & Text Extraction**
  * **Assigned Member:** Kenneth Wong
  * **Description:** 
  Handles file upload (PDF, DOCX, or pasted text), converts it into clean plain text, and preps it for the parsing engine. Includes handling edge cases like scanned/image-based PDFs (OCR fallback).

* **Feature 2: AI-Powered Extraction Engine**
  * **Assigned Member:** Tony Christopher
  * **Description:** 
  Sends parsed text to the AI API with a prompt engineered to extract structured data (event name, date, type — exam/assignment/reading, and weight/importance if listed). Returns clean JSON the frontend can render.

* **Feature 3: Interactive Calendar View & Editing**
  * **Assigned Member:** David Girgis
  * **Description:** 
  Builds the visual calendar/timeline UI where extracted events appear, and allows the student to manually edit, delete, or add events in case the parser misses or misreads something (important fallback for trust in the tool).

* **Feature 4: Multi-Course Aggregation Dashboard**
  * **Assigned Member:** Diego Ordonez
  * **Description:** 
  Combines events across multiple uploaded syllabi into a single unified view, with smart prioritization (e.g., surfacing what's due soonest or weighted heaviest) rather than just a flat merged list.

* **Feature 5: Calendar Export & Sync Integration**
  * **Assigned Member:** Junjie 
  * **Description:** Builds the Google Calendar API integration and/or ``.ics`` file export, plus optional reminder/notification settings (email or push) so events sync into whatever calendar system the student already uses.

## Getting Started

### Requirements

- Node.js and npm
- A modern web browser

### Run the local demo

1. Clone the repository:

   ```bash
   git clone https://github.com/botkii/csc47300-2026-fall-claude_warriors.git
   ```

2. Move into the project folder:

   ```bash
   cd csc47300-2026-fall-claude_warriors
   ```

3. Install the project dependency:

   ```bash
   npm install
   ```

4. Start the Vite development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed in the terminal, usually `http://localhost:5173`.

The browser loads the TypeScript files in `scripts/` through Vite. The current demo uses local mock data, so no backend, database, API key, or environment file is needed.

### Create a production build

To check that the project builds successfully:

```bash
npm run build
```

Press `Ctrl+C` in the terminal to stop the development server.
