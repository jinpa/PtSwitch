import 'dotenv/config';

/**
 * Load env and return credentials + array of { token, name }.
 * Supports TOKEN_1/NAME_1, TOKEN_2/NAME_2, ... (stops at first missing index).
 */
export function loadConfig() {
  const username = process.env.MEDBRIDGE_USERNAME;
  const password = process.env.MEDBRIDGE_PASSWORD;
  if (!username || !password) {
    throw new Error('MEDBRIDGE_USERNAME and MEDBRIDGE_PASSWORD must be set in .env');
  }

  const programs = [];
  for (let i = 1; i <= 20; i++) {
    const token = process.env[`TOKEN_${i}`]?.trim();
    const name = process.env[`NAME_${i}`]?.trim();
    if (!token || !name) break;
    programs.push({ token, name });
  }

  if (programs.length === 0) {
    throw new Error('At least one TOKEN_n and NAME_n pair must be set in .env');
  }

  return { username, password, programs };
}
