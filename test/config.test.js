import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';

test('loadConfig rejects a project without supervisor.config.json', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'supervisor-no-config-'));

  await assert.rejects(
    () => loadConfig(projectDir),
    /Missing supervisor config/
  );
});

test('loadConfig resolves stage prompt paths relative to project root', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'supervisor-config-'));
  await writeFile(path.join(projectDir, 'CLAUDE_PROMPT.md'), 'do work');
  await writeFile(path.join(projectDir, 'supervisor.config.json'), JSON.stringify({
    stages: {
      'stage-001': {
        promptFile: 'CLAUDE_PROMPT.md',
        timeoutMinutes: 5,
        testCommands: ['npm test']
      }
    }
  }));

  const config = await loadConfig(projectDir);

  assert.equal(config.stages['stage-001'].promptFile, path.join(projectDir, 'CLAUDE_PROMPT.md'));
  assert.equal(config.stages['stage-001'].timeoutMinutes, 5);
  assert.equal(config.stages['stage-001'].requireChanges, true);
  assert.deepEqual(config.stages['stage-001'].requiredChangedPaths, []);
  assert.deepEqual(config.stages['stage-001'].expectedArtifacts, []);
  assert.deepEqual(config.stages['stage-001'].failureLogPatterns, []);
});
