# PtSwitch

Consolidate multiple MedBridge Go workout programs into one static site. Run on demand via `npm run scrape`; credentials and tokens live in `.env`.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   npx playwright install chromium
   ```

   If Chromium fails to run (e.g. in some CI/sandbox environments), the scraper will try to use system Chrome if available (`channel: 'chrome'`).

2. **Configure `.env`**

   Copy `.env.example` to `.env` and set:

   - `MEDBRIDGE_USERNAME` / `MEDBRIDGE_PASSWORD` — one account for all programs.
   - `TOKEN_1`, `NAME_1`, `TOKEN_2`, `NAME_2`, … — access tokens and display names (one program per token).

## Run

```bash
npm run scrape
```

This will:

- For each token: open `https://medbridgego.com/access_token/<TOKEN>`, sign in when prompted, then scrape that program’s exercises (names, descriptions, sets/reps).
- Write a static site under `dist/` with a top nav (one item per program). Open `dist/index.html` in a browser.

If a token fails (expired, network, or site change), the site is still built; failed programs are marked in the nav (e.g. “Program name – failed to load”).

## Optional

- **Debug HTML:** set `DEBUG_HTML=1` when running to write `debug-<name>.html` files with the scraped page content.

## Notes

- **Different programs per token:** The app visits each token’s URL and re-verifies the token after login so the server can associate the session with that program. If you still see the same program for every token, MedBridge may be returning one program per account for your setup.
- **Videos:** Not included in this version; only text (names, descriptions, sets/reps) is scraped.
