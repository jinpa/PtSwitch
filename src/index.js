import { loadConfig } from './config.js';
import { savePrograms } from './data.js';
import { scrapeProgram } from './scraper.js';
import { buildSite } from './site-builder.js';

async function main() {
  console.log('Loading config...');
  const config = loadConfig();
  console.log(`Found ${config.programs.length} program(s): ${config.programs.map((p) => p.name).join(', ')}`);

  const results = [];
  for (const program of config.programs) {
    console.log(`Scraping "${program.name}" (token ${program.token})...`);
    const result = await scrapeProgram(program, config);
    results.push(result);
    if (result.error) {
      console.log(`  Failed: ${result.error}`);
    } else {
      console.log(`  Got ${result.exercises?.length ?? 0} exercise(s)`);
    }
  }

  const dataPath = await savePrograms(results);
  console.log(`Saved scraped data to ${dataPath}`);

  console.log('Building static site...');
  const outPath = await buildSite(results);
  console.log(`Done. Open ${outPath} in a browser.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
