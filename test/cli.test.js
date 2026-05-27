import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCommand } from '../src/processUtils.js';

async function writeFakeClaude(dir) {
  const scriptPath = path.join(dir, process.platform === 'win32' ? 'fake-claude.cmd' : 'fake-claude');
  const content = process.platform === 'win32'
    ? '@echo off\r\necho fake claude ran\r\necho %SUPERVISOR_STAGE%> env-stage.txt\r\necho %SUPERVISOR_PROMPT_FILE%> env-prompt-file.txt\r\necho %*> args.txt\r\necho updated> src\\app.js\r\nexit /b 0\r\n'
    : '#!/usr/bin/env sh\necho fake claude ran\necho "$SUPERVISOR_STAGE" > env-stage.txt\necho "$SUPERVISOR_PROMPT_FILE" > env-prompt-file.txt\necho "$*" > args.txt\necho updated > src/app.js\nexit 0\n';

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
  await writeFile(path.join(projectDir, 'CLAUDE_PROMPT.md'), 'edit src/app.js\nthis is a multiline prompt that must not be passed raw\n');
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
      allowedPaths: ['src/**', 'env-stage.txt', 'env-prompt-file.txt', 'args.txt'],
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
  assert.equal(summary.failedGates, 0);
  assert.equal(summary.blockedGates, 0);
  const effectivePrompt = await readFile(path.join(summary.runDir, 'effective-prompt.md'), 'utf8');
  const envStage = (await readFile(path.join(projectDir, 'env-stage.txt'), 'utf8')).trim();
  const envPromptFile = (await readFile(path.join(projectDir, 'env-prompt-file.txt'), 'utf8')).trim();
  const args = await readFile(path.join(projectDir, 'args.txt'), 'utf8');
  assert.match(effectivePrompt, /multiline prompt/);
  assert.equal(envStage, 'stage-001');
  assert.equal(envPromptFile, path.join(summary.runDir, 'effective-prompt.md'));
  assert.doesNotMatch(args, /this is a multiline prompt that must not be passed raw/);
  assert.match(args, /effective-prompt\.md/);
  const review = await readFile(summary.reviewFile, 'utf8');
  assert.match(review, /# Review Request/);
});
