'use strict';

const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];
const checked = [];

function fail(message) {
  failures.push(message);
}

function walk(dir, options = {}, output = []) {
  const excluded = new Set(options.excluded || []);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, options, output);
    else output.push(fullPath);
  }
  return output;
}

for (const file of ['package.json', 'package-lock.json', 'client/package.json', 'client/package-lock.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    checked.push(`JSON ${file}`);
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message})`);
  }
}

const sourceFiles = walk(root, { excluded: ['node_modules', 'client', '.git', 'dist'] })
  .filter(file => file.endsWith('.js'));
for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${path.relative(root, file)}: ${result.stderr.trim()}`);
}
checked.push(`Node syntax ${sourceFiles.length} files`);

const rootPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(rootPackage.dependencies || {}),
  ...Object.keys(rootPackage.devDependencies || {})
]);
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
const importPattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importPattern.exec(source))) {
    const name = match[1];
    if (name.startsWith('.') || name.startsWith('/') || name.startsWith('node:')) continue;
    const packageName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
    if (!builtins.has(packageName) && !declared.has(packageName)) {
      fail(`${path.relative(root, file)} imports undeclared package "${packageName}"`);
    }
  }
}
checked.push('Backend direct dependencies');

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const exampleKeys = new Set(
  envExample.split(/\r?\n/)
    .map(line => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
    .filter(Boolean)
);
const envPattern = /process\.env\.([A-Z][A-Z0-9_]*)/g;
const referencedEnv = new Set();
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = envPattern.exec(source))) referencedEnv.add(match[1]);
}
for (const key of referencedEnv) {
  if (!exampleKeys.has(key)) fail(`.env.example is missing ${key}`);
}
checked.push(`Environment template ${referencedEnv.size} keys`);

const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const required of ['node_modules/', 'client/dist/', '.env']) {
  if (!gitignore.includes(required)) fail(`.gitignore is missing ${required}`);
}
checked.push('Git ignore safety rules');

if (failures.length) {
  console.error('\nProject check failed:\n');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('Project check passed:');
for (const item of checked) console.log(`- ${item}`);
