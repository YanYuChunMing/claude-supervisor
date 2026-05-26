import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCommand } from '../src/processUtils.js';

async function writeFakeClaude(dir) {
  const scriptPath = path.join(dir, process.platform === 'win32' ? 'fake-claude.cmd' : 'fake-claude');
  const content = process.platform === 'win32'
    ? '@echo off\r\necho fake claude ran\r\necho updated> src\\app.js\r\nexit /b 0\r\n'
    : '#!/usr/bin/env sh\necho fake claude ran\necho updated > src/app.js\nexit 0\n';

  await writeFile(scriptPath, content);
  if (process.platform !== 'win32') {
    await chmod(scriptPath, 0o755);
  }
  return scriptPath;
}

test('CLI run prints JSON summary and writes review artifacts', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'supervisor-cli-project-'));
  const fakeClaude = await writeFakeClaude(projectDir);

  await runCommand('git', ['init'], { cwd: projectDir });
  await runCommand('git', ['config', 'user.email', 'test@example.com'], { cwd: projectDir });
  await runCommand('git', ['config', 'user.name', 'Test User'], { cwd: projectDir });
  await mkdir(path.join(projectDir, 'src'));
  await writeFile(path.join(projectDir, 'src', 'app.js'), 'initial\n');
  await writeFile(path.join(projectDir, 'CLAUDE_PROMPT.md'), 'edit src/app.js');
  await writeFile(path.join(projectDir, 'supervisor.config.json'), JSON.stringify({
    claudeCommand: fakeClaude,
    permissionMode: 'acceptEdits',
    allowedTools: ['Read', 'Edit'],
    stages: {
      'stage-001': {
        promptFile: 'CLAUDE_PROMPT.md',
        timeoutMinutes: 1,
        requireChanges: false,
        testCommands: []
      }
    },
    pathPolicy: {
      allowedPaths: ['src/**'],
      blockedPaths: ['.env', '.env.*', 'secrets/**', '.git/**'],
      sensitivePaths: []
    },
    limits: {
      maxChangedFiles: 10,
      maxDiffLines: 100
    }
  }));
  await runCommand('git', ['add', '.'], { cwd: projectDir });
  await runCommand('git', ['commit', '-m', 'initial'], { cwd: projectDir });

  const cliPath = path.resolve('src/cli.js');
  const result = await runCommand(process.execPath, [cliPath, 'run', '--project', projectDir, '--stage', 'stage-001'], {
    cwd: path.resolve('.')
  });
  const summary = JSON.parse(result.stdout);

  assert.equal(result.exitCode, 0, result.stderr || result.stdout);
  assert.ok(['passed', 'needs_review', 'blocked'].includes(summary.status));
  assert.equal(typeof summary.ok, 'boolean');
  const review = await readFile(summary.reviewFile, 'utf8');
  assert.match(review, /# Review Request/);
});
