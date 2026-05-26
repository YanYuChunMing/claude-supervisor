import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePathPolicy, normalizeGitPath } from '../src/pathPolicy.js';

const policy = {
  allowedPaths: ['src/**', 'test/**', 'tests/**', 'docs/**', 'README.md', 'package.json'],
  blockedPaths: ['.env', '.env.*', 'secrets/**', '.git/**'],
  sensitivePaths: ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'docker-compose.yml']
};

test('normalizes Windows paths to git-style forward slash paths', () => {
  assert.equal(normalizeGitPath('src\\cli\\index.js'), 'src/cli/index.js');
});

test('blocks environment, secret, and git internal paths', () => {
  const result = evaluatePathPolicy(['.env', '.env.local', 'secrets/key.txt', '.git/config'], policy);

  assert.equal(result.pathViolations.length, 4);
  assert.equal(result.sensitiveChanges.length, 0);
  assert.equal(result.outsideAllowed.length, 0);
  assert.deepEqual(result.pathViolations.map((item) => item.file), [
    '.env',
    '.env.local',
    'secrets/key.txt',
    '.git/config'
  ]);
});

test('marks lock files and docker compose as sensitive', () => {
  const result = evaluatePathPolicy(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'docker-compose.yml'], policy);

  assert.equal(result.pathViolations.length, 0);
  assert.equal(result.sensitiveChanges.length, 4);
});

test('marks files outside allowed paths for review', () => {
  const result = evaluatePathPolicy(['src/app.js', 'scripts/deploy.ps1', 'README.md'], policy);

  assert.deepEqual(result.outsideAllowed.map((item) => item.file), ['scripts/deploy.ps1']);
});
