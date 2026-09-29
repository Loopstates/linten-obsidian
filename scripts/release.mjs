#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function run(cmd, cwd) {
  log(`  $ ${cmd}`, BLUE);
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (err) {
    const errorMsg = err.stderr ? err.stderr.trim() : err.message;
    throw new Error(`Command failed in ${cwd}: ${cmd}\n${errorMsg}`);
  }
}

const args = process.argv.slice(2);
const targetVersion = args[0];
const releaseNote = args[1] || `Release v${targetVersion}`;

if (!targetVersion || !/^\d+\.\d+\.\d+$/.test(targetVersion)) {
  log(`\n❌ Error: Please specify a valid semantic version (e.g. 1.0.4)`, RED);
  log(`Usage: npm run release <version> [optional-note]`, YELLOW);
  log(`Example: npm run release 1.0.4 "feat: improved link health caching"\n`, YELLOW);
  process.exit(1);
}

const privateRoot = resolve('.');
const publicRoot = existsSync(resolve(join(privateRoot, '../obsidian-public')))
  ? resolve(join(privateRoot, '../obsidian-public'))
  : resolve(join(privateRoot, '../linten-obsidian-public'));
const vaultPluginRoot = '/Volumes/Jitesh-MacBook-SSD/Resources/obsidian/Obsidian/.obsidian/plugins/linten';

log(`\n🚀 Starting Automated Release for v${targetVersion}...`, BOLD + GREEN);
log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, BLUE);

// 1. Update Version in Private Source Repo
log(`\n1. Updating versions in Private Source Repo...`, BOLD);
const pkgPath = join(privateRoot, 'package.json');
const manifestPath = join(privateRoot, 'manifest.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
pkg.version = targetVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
log(`  ✓ Updated package.json to v${targetVersion}`, GREEN);

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
manifest.version = targetVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
log(`  ✓ Updated manifest.json to v${targetVersion}`, GREEN);

// 2. Build Production Bundle
log(`\n2. Compiling production bundle (esbuild)...`, BOLD);
run('npm run build', privateRoot);
log(`  ✓ Built main.js cleanly`, GREEN);

// 3. Commit, Tag, and Push Private Repo
log(`\n3. Tagging & pushing Private Source Repo...`, BOLD);
run('git add manifest.json package.json main.js styles.css', privateRoot);
try {
  run(`git commit -m "chore: release v${targetVersion}"`, privateRoot);
} catch (e) {
  log(`  ℹ Nothing new to commit in private repo`, YELLOW);
}
run(`git tag -a ${targetVersion} -m "Release v${targetVersion}: ${releaseNote}"`, privateRoot);
run(`git push origin main --tags`, privateRoot);
log(`  ✓ Pushed tag ${targetVersion} to Loopstates/linten-obsidian-source`, GREEN);

// 4. Synchronize to Public Distribution Repo
log(`\n4. Synchronizing to Public Distribution Repo...`, BOLD);
if (!existsSync(publicRoot)) {
  throw new Error(`Public distribution directory not found at: ${publicRoot}`);
}

const filesToSync = ['main.js', 'manifest.json', 'styles.css', 'README.md', 'LICENSE'];
for (const file of filesToSync) {
  const src = join(privateRoot, file);
  const dest = join(publicRoot, file);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    log(`  ✓ Copied ${file}`, GREEN);
  }
}

// 5. Commit, Tag, and Push Public Repo
log(`\n5. Tagging & pushing Public Distribution Repo...`, BOLD);
run('git add .', publicRoot);
try {
  run(`git commit -m "chore: release v${targetVersion}"`, publicRoot);
} catch (e) {
  log(`  ℹ Nothing new to commit in public repo`, YELLOW);
}
run(`git tag -a ${targetVersion} -m "Release v${targetVersion}: ${releaseNote}"`, publicRoot);
run(`git push origin main --tags`, publicRoot);
log(`  ✓ Pushed tag ${targetVersion} to Loopstates/linten-obsidian`, GREEN);

// 6. Synchronize to Live Local Obsidian Vault (if present)
if (existsSync(vaultPluginRoot)) {
  log(`\n6. Updating live Obsidian test vault...`, BOLD);
  copyFileSync(join(privateRoot, 'main.js'), join(vaultPluginRoot, 'main.js'));
  copyFileSync(join(privateRoot, 'manifest.json'), join(vaultPluginRoot, 'manifest.json'));
  copyFileSync(join(privateRoot, 'styles.css'), join(vaultPluginRoot, 'styles.css'));
  log(`  ✓ Updated live vault plugin files`, GREEN);
}

log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, BLUE);
log(`🎉 Release v${targetVersion} Published Successfully!`, BOLD + GREEN);
log(`• Private Source: https://github.com/Loopstates/linten-obsidian-source (tag: ${targetVersion})`);
log(`• Public Release: https://github.com/Loopstates/linten-obsidian (tag: ${targetVersion})`);
log(`• Publish assets on GitHub: https://github.com/Loopstates/linten-obsidian/releases/new?tag=${targetVersion}&title=v${targetVersion}\n`, BLUE);
