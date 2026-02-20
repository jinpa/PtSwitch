# Product Requirements Document: PtSwitch

## Overview

**Goal:** A tool that authenticates to MedBridge Go, scrapes workout programs from one or more access-token URLs, and generates a single browsable static site with a top nav to switch between programs. Run on demand via `npm run scrape`; credentials and tokens stored in `.env`.

**Why:** MedBridge Go does not make it easy to switch between workouts created by different physical therapists. This app consolidates them into one static site.

---

## User flow

1. User configures `.env` with MedBridge Go username, password, and one or more token/name pairs (e.g. `TOKEN_1`, `NAME_1` = "knee"; `TOKEN_2`, `NAME_2` = "elbow").
2. User runs `npm run scrape`.
3. For each token, the app goes **first** to `https://medbridgego.com/access_token/$TOKEN` (no prior visit to medbridgego.com). When that page prompts for login, the app authenticates with username/password, then scrapes the single program (list of exercises with names, descriptions, sets/reps, etc.).
4. App generates a static site (e.g. in `dist/` or `output/`) with:
   - A **top nav** with one item per token (e.g. "Knee", "Elbow"); selecting one shows that program’s exercises.
   - Full exercise list per program: names, descriptions, sets/reps (and any other text metadata we can reliably scrape). **Videos are out of scope for the initial release.**
5. If a token fails (expired, network, or site change), the app still generates the site for successful tokens and **clearly marks failed tokens** (e.g. in the nav or a dedicated section: "Knee – failed to load").

---

## Scope

### In scope (MVP)

- **Config:** `.env` with username, password, and token/name pairs; manual edit only.
- **Scraping:** Playwright; for each token, navigate first to `https://medbridgego.com/access_token/$TOKEN`, authenticate when prompted on that page, then scrape the **single program** per token. Do not authenticate at medbridgego.com before visiting the access_token URL.
- **Data per program:** Full list of exercises with **names, descriptions, sets/reps** (and any other text fields we can reliably get). No video or image media.
- **Output:** Browsable static site (HTML/CSS/JS) with:
  - **Top nav** to switch between programs (one per token).
  - Each program view shows the full exercise list with the above fields.
- **Multi-token:** Must support **at least two tokens**; MVP verification includes running with two tokens and **confirming the workouts are different** (different exercise lists/content).
- **Failure handling:** Run all tokens; use the ones that succeed; mark failures clearly (e.g. "Program name – failed to load") so the user knows which token(s) failed.

### Out of scope (MVP)

- Videos (and optionally images) — deferred to a later phase.
- UI for adding/editing tokens (manual `.env` only).
- "Regenerate" button or scheduler; run via `npm run scrape` only.
- Authentication methods other than username/password.

---

## Technical constraints

- **Scraping:** Playwright (browser automation).
- **Credentials:** Stored in `.env`; `.env` must be in `.gitignore`.
- **Output:** Static files only (no server required to view the site).

---

## Success criteria for MVP

1. With two different tokens in `.env`, `npm run scrape` completes and produces a static site.
2. The top nav shows two entries (e.g. "Knee", "Elbow"); switching between them shows **different** exercise lists (content differs per token).
3. Each program view shows a full exercise list with names, descriptions, and sets/reps (or equivalent) where the site provides them.
4. If one token fails, the site still generates; the failed program is clearly marked and the other program(s) are usable.

---

## Future phases (not in MVP)

- Add video (and optionally image) support.
- Optional "Regenerate" control (e.g. simple local UI or script wrapper).
- Optional config file or UI for token/name management instead of editing `.env` only.

---

## Open questions / to be discovered during build

- Exact DOM structure and selectors on MedBridge Go (login form when shown from access_token page, program container, exercise list, fields for sets/reps/descriptions). Will be resolved during implementation.
- Whether session/cookies from the first token’s authentication are sufficient when visiting subsequent token URLs, or if the user is prompted to sign in again per token.
