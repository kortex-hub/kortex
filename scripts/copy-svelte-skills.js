/**
 * Copies Svelte best-practices skills shipped with @sveltejs/opencode
 * into the local .agents/skills/ directory so that AI code assistants
 * can discover them at development time.
 *
 * This script is invoked from the postinstall hook in package.json and
 * is cross-platform (no shell-specific commands).
 */

const { cpSync, existsSync } = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '..', 'node_modules', '@sveltejs', 'opencode', 'skills');
const destination = path.resolve(__dirname, '..', '.agents', 'skills');

if (!existsSync(source)) {
  console.log('Skipping svelte skills copy: @sveltejs/opencode not installed.');
  process.exit(0);
}

cpSync(source, destination, { recursive: true });
console.log('Copied svelte skills to .agents/skills/');
