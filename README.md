# csc47300-2026-fall-claude_warriors
Group for CSC47300

# Project Name
Syllabus-to-Calendar Parser
## Overview
This is a web tool that lets students upload or paste in a course syllabus and automatically extracts key dates — exams, assignment deadlines, readings, project milestones — and converts them into a clean, exportable calendar. Instead of manually transcribing every date from a dense, inconsistently formatted PDF (which most students either do sloppily or skip entirely), the tool does the heavy lifting in seconds.

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
  * **Assigned Member:** Name
  * **Description:** 
  Combines events across multiple uploaded syllabi into a single unified view, with smart prioritization (e.g., surfacing what's due soonest or weighted heaviest) rather than just a flat merged list.

* **Feature 5: Calendar Export & Sync Integration**
  * **Assigned Member:** Name
  * **Description:** Builds the Google Calendar API integration and/or ``.ics`` file export, plus optional reminder/notification settings (email or push) so events sync into whatever calendar system the student already uses.

## Getting Started
1. Clone the repository:
   ```bash
   git clone N/A
