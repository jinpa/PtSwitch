import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const OUT_DIR = 'dist';
export const PROGRAMS_JSON = join(OUT_DIR, 'programs.json');

/**
 * Save scraped program data to JSON.
 * @param {Array<{ name: string, exercises?: Array<{ name: string, description?: string, setsReps?: string }>, error?: string }>} programs
 */
export async function savePrograms(programs) {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(PROGRAMS_JSON, JSON.stringify(programs, null, 2), 'utf8');
  return PROGRAMS_JSON;
}

/**
 * Load program data from JSON. Returns null if file missing or invalid.
 * @returns {Promise<Array<{ name: string, exercises?: Array, error?: string }> | null>}
 */
export async function loadPrograms() {
  try {
    const raw = await readFile(PROGRAMS_JSON, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
