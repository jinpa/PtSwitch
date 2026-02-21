import { loadPrograms } from './data.js';
import { buildSite } from './site-builder.js';

async function main() {
  const programs = await loadPrograms();
  if (!programs || programs.length === 0) {
    console.error('No scraped data found. Run "npm run scrape" first to create dist/programs.json');
    process.exit(1);
  }

  console.log(`Formatting site from ${programs.length} program(s)...`);
  const outPath = await buildSite(programs);
  console.log(`Done. Open ${outPath} in a browser.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
