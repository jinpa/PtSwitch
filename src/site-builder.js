import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const OUT_DIR = 'dist';

/**
 * programs: array of { name, exercises } or { name, error }
 */
export async function buildSite(programs) {
  await mkdir(OUT_DIR, { recursive: true });

  const navItems = programs.map((p, i) => ({
    id: `program-${i}`,
    name: p.error ? `${p.name} – failed to load` : p.name,
    failed: !!p.error,
  }));

  const programData = programs.map((p) => ({
    name: p.name,
    failed: !!p.error,
    exercises: dedupeExercises(p.exercises || []),
    errorMessage: p.error || null,
  }));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PtSwitch – Workout Programs</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #f5f5f5; color: #1a1a1a; }
    .nav { background: #2d3748; color: #fff; padding: 0.75rem 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .nav a { color: #e2e8f0; text-decoration: none; padding: 0.5rem 0.75rem; border-radius: 6px; }
    .nav a:hover { background: #4a5568; color: #fff; }
    .nav a.active { background: #4a5568; color: #fff; font-weight: 600; }
    .nav .failed { opacity: 0.8; }
    main { max-width: 720px; margin: 0 auto; padding: 1.5rem; }
    .program { display: none; }
    .program.active { display: block; }
    .program h1 { margin: 0 0 1rem; font-size: 1.5rem; color: #2d3748; }
    .program.failed p.error { background: #fed7d7; color: #c53030; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .exercise-list { counter-reset: exercise-num; list-style: none; padding: 0; margin: 0; }
    .exercise { background: #fff; border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.06); counter-increment: exercise-num; border-left: 4px solid #4299e1; }
    .exercise h3 { margin: 0 0 0.5rem; font-size: 1.15rem; color: #2d3748; display: flex; align-items: baseline; gap: 0.5rem; }
    .exercise h3::before { content: counter(exercise-num) "."; font-weight: 700; color: #4299e1; min-width: 1.75em; }
    .exercise .description { color: #4a5568; font-size: 0.95rem; line-height: 1.55; margin-bottom: 0.5rem; }
    .exercise .description.steps { margin-left: 0; padding-left: 0; }
    .exercise .steps { margin: 0.5rem 0 0; padding-left: 1.25rem; }
    .exercise .steps li { margin-bottom: 0.35rem; }
    .exercise .sets-reps { display: inline-block; font-size: 0.85rem; font-weight: 600; color: #2b6cb0; background: #ebf8ff; padding: 0.25rem 0.6rem; border-radius: 6px; margin-top: 0.5rem; }
    .empty { color: #718096; font-style: italic; }
  </style>
</head>
<body>
  <nav class="nav">
    ${navItems.map((item) => `<a href="#${item.id}" class="program-link ${item.failed ? 'failed' : ''}" data-program="${item.id}">${escapeHtml(item.name)}</a>`).join('\n    ')}
  </nav>
  <main>
    ${programData.map((prog, i) => `
    <section id="program-${i}" class="program" data-program-index="${i}">
      <h1>${escapeHtml(prog.name)}</h1>
      ${prog.failed ? `<p class="error">This program could not be loaded: ${escapeHtml(prog.errorMessage || 'Unknown error')}</p>` : ''}
      ${!prog.failed && (!prog.exercises || prog.exercises.length === 0) ? '<p class="empty">No exercises found for this program.</p>' : ''}
      ${!prog.failed && prog.exercises && prog.exercises.length ? `
      <ol class="exercise-list" aria-label="Exercises">
      ${prog.exercises.map((ex) => `
      <li class="exercise">
        <h3>${escapeHtml(ex.name)}</h3>
        ${ex.description ? `<div class="description">${formatDescription(ex.description)}</div>` : ''}
        ${ex.setsReps ? `<span class="sets-reps">${escapeHtml(ex.setsReps)}</span>` : ''}
      </li>`).join('')}
      </ol>` : ''}
    </section>`).join('')}
  </main>
  <script>
    const programs = document.querySelectorAll('.program');
    const links = document.querySelectorAll('.program-link');
    function showProgram(index) {
      programs.forEach((p, i) => p.classList.toggle('active', i === index));
      links.forEach((l, i) => { l.classList.toggle('active', i === index); });
      history.replaceState(null, '', '#' + programs[index].id);
    }
    links.forEach((link, i) => {
      link.addEventListener('click', (e) => { e.preventDefault(); showProgram(i); });
    });
    const hash = document.location.hash;
    const idx = hash ? Array.from(programs).findIndex(p => p.id === hash.slice(1)) : 0;
    showProgram(idx >= 0 ? idx : 0);
  </script>
</body>
</html>`;

  const outPath = join(OUT_DIR, 'index.html');
  await writeFile(outPath, html, 'utf8');
  return outPath;
}

function normalizeExerciseKey(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function dedupeExercises(exercises) {
  const seen = new Set();
  return exercises.filter((ex) => {
    const key = normalizeExerciseKey(ex.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDescription(description) {
  if (!description || typeof description !== 'string') return '';
  const trimmed = description.trim();
  if (!trimmed) return '';
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return escapeHtml(trimmed);
  return '<ul class="steps">' + lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('') + '</ul>';
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
