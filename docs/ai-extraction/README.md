# AI syllabus extraction

This feature uses Google's Gemini API. The API key stays in a local `.env` file in the project root and is not committed.

## Local setup

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. In the project root (the same folder as `package.json`), create a file named `.env` with:

   ```dotenv
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-3.8-flash
   ```

   Replace `your_key_here` with your own key. The model line is optional; the server defaults to `gemini-3.8-flash`. `.env` is ignored by Git. Never commit or share it.
3. Use Node.js 20.6 or newer and install dependencies with `npm install`.
4. In one terminal, start the API:

   ```bash
   npm run api
   ```

5. In another terminal, start the frontend:

   ```bash
   npm run dev
   ```

Upload a searchable PDF or Word `.docx`, upload a `.txt`/`.md` file, or paste syllabus text, then select **Find deadlines**. The API extracts event titles, dates, types, listed weights, source text, and confidence for review before calendar import.

Scanned/image-only PDFs require OCR, which this feature does not include. Legacy `.doc` files are not supported. Files must be smaller than 12 MB. Gemini model and free-tier availability/limits can change; check [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing). Avoid uploading sensitive information unless you are comfortable with Google's API data-use terms.

## Troubleshooting

- If Gemini returns a 404, check that the model in `.env` is available to your API key, then restart `npm run api`.
- If the API reports a missing key, check that `.env` is in the project root and that `GEMINI_API_KEY` is set.
- Never post your API key in issues, logs, or chat.
