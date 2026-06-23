#!/usr/bin/env node
/*
 * One-command setup for the Togomoto Industries demo.
 *
 * Run it with:   node scripts/setup.mjs      (or:  npm run setup)
 *
 * It uses only Node.js built-ins, so it works BEFORE `npm install` has run.
 * Steps: check Node version -> install dependencies -> create .dev.vars ->
 * create + migrate the local database -> load the demo data.
 */
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const GREEN = '\x1b[32m', RED = '\x1b[31m', BOLD = '\x1b[1m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const step = (n, m) => console.log(`\n${BOLD}[${n}/5] ${m}${RESET}`);
const die = (m) => { console.error(`\n${RED}✗ ${m}${RESET}`); process.exit(1); };

function run(cmd) {
  console.log(`${DIM}> ${cmd}${RESET}`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log(`${BOLD}\n  Togomoto Industries — local demo setup${RESET}\n  ${DIM}This takes a few minutes the first time (it downloads dependencies).${RESET}`);

// 1. Node version (Astro 5 needs Node 20.3+ / 22+)
step(1, 'Checking your Node.js version');
const major = Number(process.versions.node.split('.')[0]);
if (Number.isNaN(major) || major < 20) {
  die(`Node ${process.versions.node} is too old. Install Node.js 20 LTS or newer from https://nodejs.org/ and run this again.`);
}
ok(`Node ${process.versions.node} is good.`);

// 2. Dependencies
step(2, 'Installing dependencies (npm install)');
try { run('npm install'); ok('Dependencies installed.'); }
catch { die('npm install failed. Check your internet connection and try again.'); }

// 3. Local dev vars
step(3, 'Creating .dev.vars (local config)');
if (existsSync('.dev.vars')) {
  ok('.dev.vars already exists — leaving it as is.');
} else {
  copyFileSync('.dev.vars.example', '.dev.vars');
  ok('Created .dev.vars from .dev.vars.example (safe Turnstile TEST keys).');
}

// 4. Database schema (local D1 via Miniflare)
step(4, 'Creating the local database (migrations)');
try { run('npm run db:migrate:local'); ok('Database schema ready.'); }
catch { die('Migration failed. See the output above.'); }

// 5. Demo data
step(5, 'Loading demo data (seed)');
try { run('npm run db:seed:local'); ok('Demo inventory loaded.'); }
catch { die('Seeding failed. See the output above.'); }

console.log(`\n${GREEN}${BOLD}  All done!${RESET}\n`);
console.log(`  Start the site with:\n\n    ${BOLD}npm run dev${RESET}\n`);
console.log(`  Then open ${BOLD}http://localhost:4321${RESET} in your browser.`);
console.log(`  Press ${BOLD}Ctrl + C${RESET} in the terminal to stop the server when you're done.\n`);
