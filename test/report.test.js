import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { decideStatus, writeReviewArtifacts } from '../src/report.js';

test('writeReviewArtifacts writes status JSON and review markdown', async () => {
  const runDir = await mkdtemp(path.join(tmpdir(), 'supervisor-report-'));
  const summary = {
    ok: false,
    project: 'C:\\project',
    stage: 'stage-001',
    status: 'needs_review',
    runDir,
    timedOut: false,
    claudeExitCode: 0,
    testsPassed: false,
    changedFiles: 2,
    pathViolations: 0,
    sensitiveChanges: 1
  };
  const details = {
    changedFiles: ['src/app.js', 'package-lock.json'],
    policyResult: {
      pathViolations: [],
      sensitiveChanges: [{ file: 'package-lock.json', rule: 'sensitivePaths', severity: 'review' }],
      outsideAllowed: []
    },
    testResults: [{ command: 'npm test', exitCode: 1, timedOut: false }],
    logs: {
      claudeLog: path.join(runDir, 'claude.log'),
      testsLog: path.join(runDir, 'tests.log'),
      diffFile: path.join(runDir, 'diff.patch')
    }
  };

  const files = await writeReviewArtifacts(runDir, summary, details);
  const status = JSON.parse(await readFile(files.statusFile, 'utf8'));
  const review = await readFile(files.reviewFile, 'utf8');

  assert.equal(status.stage, 'stage-001');
  assert.match(review, /# Review Request/);
  assert.match(review, /package-lock\.json/);
});

test('decideStatus returns needs_review when stage requires changes but none were detected', () => {
  const result = decideStatus({
    testsPassed: true,
    timedOut: false,
    claudeExitCode: 0,
    policyResult: {
      pathViolations: [],
      sensitiveChanges: [],
      outsideAllowed: []
    },
    changedFilesCount: 0,
    diffLineCount: 0,
    limits: { maxChangedFiles: 10, maxDiffLines: 1000 },
    requireChanges: true
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.ok, false);
});
