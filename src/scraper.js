import { chromium } from 'playwright';
import { writeFile } from 'fs/promises';

const BASE_URL = 'https://medbridgego.com';
const ACCESS_TOKEN_PATH = '/access_token';

/**
 * For a single token: go to access_token/TOKEN, login if prompted, scrape program.
 * Returns { name, exercises } or { name, error } on failure.
 */
export async function scrapeProgram({ token, name }, { username, password }) {
  const url = `${BASE_URL}${ACCESS_TOKEN_PATH}/${token}`;
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome', // use system Chrome if Playwright browsers not installed
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.setDefaultNavigationTimeout(25000);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Wait a bit for any redirect or SPA render
    await page.waitForTimeout(2000);

    // 1. FIRST: On token page, click "Verify access code" if present (binds this token to session)
    const verifyBtn = page.locator('input[type="submit"][value*="Verify"], input[value*="Verify Access Code"], button:has-text("Verify")').first();
    if (await verifyBtn.isVisible().catch(() => false)) {
      await verifyBtn.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
    }

    // 2. THEN: If we see "Sign in" (existing account), click it to get the email/password form
    const signInLink = page.locator('a[href*="sign_in"], a:has-text("Sign in")').first();
    if (await signInLink.isVisible().catch(() => false)) {
      await signInLink.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 3. Check for login form (common patterns: email + password)
    const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"], input[id*="email"], input[id*="username"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    const emailVisible = await emailInput.isVisible().catch(() => false);
    const passwordVisible = await passwordInput.isVisible().catch(() => false);

    if (emailVisible && passwordVisible) {
      await emailInput.fill(username);
      await passwordInput.fill(password);
      // Submit: button with type submit, or "Log in" / "Sign in" text
      const submit = page.locator('button[type="submit"], input[type="submit"], [type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login"), a:has-text("Log in")').first();
      await submit.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
      // Re-visit this token's URL so the server associates our session with this program
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);
      // Verify again if we're back on the token page (e.g. after login)
      if (await verifyBtn.isVisible().catch(() => false)) {
        await verifyBtn.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(3000);
      }
      // Click GO again if we're back on home
      const goBtn2 = page.getByRole('button', { name: /^go$/i }).or(page.getByRole('link', { name: /^go$/i })).or(page.locator('a:has-text("GO"), button:has-text("GO")')).first();
      if (await goBtn2.isVisible().catch(() => false)) {
        await goBtn2.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // Dismiss "Session about to expire" modal if present
    const staySignedIn = page.getByRole('button', { name: /stay signed in/i }).or(page.locator('button:has-text("Stay signed in")')).first();
    if (await staySignedIn.isVisible().catch(() => false)) {
      await staySignedIn.click();
      await page.waitForTimeout(1000);
    }

    // Try to open the exercise program (e.g. "GO" button on home)
    const goBtn = page.getByRole('button', { name: /^go$/i }).or(page.getByRole('link', { name: /^go$/i })).or(page.locator('a:has-text("GO"), button:has-text("GO")')).first();
    if (await goBtn.isVisible().catch(() => false)) {
      await goBtn.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);
    }

    // DEBUG: save HTML to inspect DOM (remove after tuning selectors)
    if (process.env.DEBUG_HTML) {
      const html = await page.content();
      await writeFile(`debug-${name.replace(/\W/g, '_')}.html`, html, 'utf8');
      console.log(`  [DEBUG] Wrote debug-${name.replace(/\W/g, '_')}.html`);
    }

    // Scrape exercises from the page (excluding modal/dialog text)
    let exercises = await extractExercises(page);
    exercises = exercises.filter(
      (e) =>
        !/session about to expire|stay signed in|sign out|you will be signed out/i.test(e.name) &&
        !/session about to expire|stay signed in|sign out/i.test(e.description || '')
    );
    return { name, exercises };
  } catch (err) {
    return { name, error: err.message || String(err) };
  } finally {
    await browser.close();
  }
}

/**
 * Extract exercises from MedBridge patient portal (Angular app).
 * Targets .resources-exercise blocks and .program-exercise-name; falls back to generic strategies.
 */
async function extractExercises(page) {
  const exercises = await page.evaluate(() => {
    const result = [];
    const text = (el) => (el && el.textContent || '').trim();
    const str = (s) => (typeof s === 'string' ? s : text(s || null)).trim();
    const skipTitle = (s) => {
      const t = str(s).replace(/\s+/g, '');
      return /^(exercisedetails|setup|thumbnails|playpause|seek|fullscreen|mute|captions)$/i.test(t) || str(s).length < 3;
    };

    // MedBridge: each exercise is in a .resources-exercise block with .program-exercise-name (h2)
    const blocks = document.querySelectorAll('.resources-exercise, [class*="resources-exercise"]');
    for (const block of blocks) {
      const nameEl = block.querySelector('.program-exercise-name, [class*="program-exercise-name"]');
      const name = nameEl ? text(nameEl) : '';
      if (!name || skipTitle(name) || name.length > 200) continue;

      const instructions = block.querySelectorAll('[class*="instruction"], .exercise-steps li, ul li');
      let description = '';
      const parts = [];
      for (const el of instructions) {
        const t = text(el);
        if (t && t.length > 15 && !/^(play|pause|seek|fullscreen|mute|captions|increase volume)/i.test(t)) parts.push(t);
      }
      if (parts.length) description = parts.join('\n');

      const meta = block.querySelector('[class*="frequency"], [class*="sets"], [class*="reps"], [class*="program-exercise-meta"]');
      const setsReps = meta ? text(meta) : '';

      result.push({
        name: name.substring(0, 300),
        description: description.substring(0, 2000),
        setsReps: (setsReps || '').substring(0, 200),
      });
    }

    // Fallback: any h2.program-exercise-name or h2/h3 that looks like an exercise title
    if (result.length === 0) {
      const names = document.querySelectorAll('.program-exercise-name, h2[class*="exercise-name"], h2, h3');
      for (const n of names) {
        const name = text(n);
        if (!name || skipTitle(name) || name.length > 150) continue;
        if (/^\d+x(daily|weekly)|^\d+\s*(min|sec|reps?|sets?)/i.test(name.replace(/\s/g, ''))) continue;
        let description = '';
        let setsReps = '';
        let parent = n.closest('[class*="exercise"]') || n.closest('.resources-exercise') || n.parentElement;
        if (parent) {
          const allText = parent.querySelectorAll('p, li, [class*="instruction"], [class*="detail"]');
          for (const el of allText) {
            const t = text(el);
            if (t.length > 20 && !/play\/pause|fullscreen|mute|seek|space|captions/i.test(t)) description = (description ? description + '\n' : '') + t;
          }
          const meta = parent.querySelector('[class*="frequency"], [class*="sets"], [class*="reps"]');
          if (meta) setsReps = text(meta);
        }
        result.push({ name: name.substring(0, 300), description: description.substring(0, 2000), setsReps: setsReps.substring(0, 200) });
      }
    }

    // Fallback 2: generic cards/articles with headings (e.g. Angular wrapper divs)
    if (result.length === 0) {
      const possibleContainers = document.querySelectorAll('[class*="exercise"], .card, article, [class*="resource"]');
      for (const container of possibleContainers) {
        const heading = container.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]');
        const name = heading ? text(heading) : text(container).split('\n')[0];
        if (!name || name.length < 3 || name.length > 200) continue;
        if (skipTitle(name) || /^\d+x(daily|weekly)|^\d+\s*(min|sec)/i.test(name.replace(/\s/g, ''))) continue;
        const descEl = container.querySelector('p, [class*="instruction"], li');
        const description = descEl ? text(descEl) : '';
        const setsRepsEl = container.querySelector('[class*="sets"], [class*="reps"], [class*="frequency"]');
        result.push({
          name: name.substring(0, 300),
          description: (description || '').substring(0, 2000),
          setsReps: (setsRepsEl ? text(setsRepsEl) : '').substring(0, 200),
        });
      }
    }

    const seen = new Set();
    return result.filter((e) => {
      const key = e.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      if (skipTitle(key) || key.length < 3) return false;
      seen.add(key);
      return true;
    });
  });

  return exercises;
}
