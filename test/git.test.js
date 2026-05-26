import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCommand } from '../src/processUtils.js';
import { collectGitStatus, collectPathsFromPorcelain } from '../src/git.js';

test('collectPathsFromPorcelain includes tracked, untracked, and rename targets', () => {
  const output = [
    ' M src/app.js',
    'A  docs/plan.md',
    '?? .env',
    'R  old/name.js -> new/name.js'
  ].join('\n');

  const paths = collectPathsFromPorcelain(output);

  assert.deepEqual(paths, ['src/app.js', 'docs/plan.md', '.env', 'new/name.js']);
});

test('collectGitStatus includes untracked files and excludes .supervisor artifacts', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'supervisor-git-test-'));
  await runCommand('git', ['init'], { cwd: projectDir });
  await runCommand('git', ['config', 'user.email', 'test@example.com'], { cwd: projectDir });
  await runCommand('git', ['config', 'user.name', 'Test User'], { cwd: projectDir });

  await mkdir(path.join(projectDir, 'src'));
  await writeFile(path.join(projectDir, 'src', 'app.js'), 'initial\n');
  await runCommand('git', ['add', '.'], { cwd: projectDir });
  await runCommand('git', ['commit', '-m', 'init'], { cwd: projectDir });

  await writeFile(path.join(projectDir, '.env'), 'SECRET=1\n');
  await mkdir(path.join(projectDir, '.supervisor'));
  await writeFile(path.join(projectDir, '.supervisor', 'tmp.log'), 'internal\n');

  const status = await collectGitStatus(projectDir);

  assert.ok(status.changedFiles.includes('.env'));
  assert.equal(status.changedFiles.some((file) => file.startsWith('.supervisor/')), false);
});
