#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { exit } from 'node:process';

const wptRepo = 'https://github.com/web-platform-tests/wpt.git';
const branch = 'master';
const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(testDir, '..');

console.log(`Cloning repo: ${wptRepo}`);

if (existsSync(resolve(packageDir, 'test/wpt'))) {
  console.log(`Directory test/wpt already exists, pulling changes`);
  execSync(`git pull --ff-only ${wptRepo} ${branch}`, {
    cwd: resolve(packageDir, 'test/wpt'),
  });
  console.log('Successfully pulled changes');
  exit(0);
}

execSync(`git clone --depth 1 --branch ${branch} --single-branch ${wptRepo}`, {
  cwd: testDir,
});
console.log('Successfully cloned repo');
console.warn(
  'Remember to set up your system to run wpt tests: https://web-platform-tests.org/running-tests/from-local-system.html'
);
exit(0);
