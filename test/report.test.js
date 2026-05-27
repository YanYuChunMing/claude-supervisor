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
    sensitiveChanges: 1,
    failedGates: 1,
    blockedGates: 0
  };
  const details = {
    gateResults: [
      {
        name: 'testsPassed',
        status: 'failed',
        severity: 'review',
        evidence: 'One or more test commands failed'
      }
    ],
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
  const legacySummaryWithGateResults = {
    ...summary,
    gateResults: [
      {
        name: 'testsPassed',
        status: 'failed',
        severity: 'review',
        evidence: 'One or more test commands failed'
      }
    ]
  };

  const files = await writeReviewArtifacts(runDir, summary, details);
  const status = JSON.parse(await readFile(files.statusFile, 'utf8'));
  const review = await readFile(files.reviewFile, 'utf8');

  assert.equal(status.stage, 'stage-001');
  assert.equal(status.gateResults[0].name, legacySummaryWithGateResults.gateResults[0].name);
  assert.match(review, /# Review Request/);
  assert.match(review, /## Gate Results/);
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
    requireChanges: true,
    changedFiles: []
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.ok, false);
  assert.equal(result.gateResults.find((gate) => gate.name === 'requireChanges').status, 'failed');
});

test('decideStatus returns needs_review when required changed paths are missing', () => {
  const result = decideStatus({
    testsPassed: true,
    timedOut: false,
    claudeExitCode: 0,
    policyResult: {
      pathViolations: [],
      sensitiveChanges: [],
      outsideAllowed: []
    },
    changedFilesCount: 1,
    changedFiles: ['docs/notes.md'],
    diffLineCount: 10,
    limits: { maxChangedFiles: 10, maxDiffLines: 1000 },
    requireChanges: true,
    requiredChangedPaths: ['src/**']
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.ok, false);
  assert.equal(result.gateResults.find((gate) => gate.name === 'requiredChangedPaths').status, 'failed');
});

test('decideStatus returns needs_review when expected artifacts are missing', () => {
  const result = decideStatus({
    testsPassed: true,
    timedOut: false,
    claudeExitCode: 0,
    policyResult: {
      pathViolations: [],
      sensitiveChanges: [],
      outsideAllowed: []
    },
    changedFilesCount: 1,
    changedFiles: ['src/app.js'],
    diffLineCount: 10,
    limits: { maxChangedFiles: 10, maxDiffLines: 1000 },
    requireChanges: true,
    expectedArtifacts: ['HANDOFF.md'],
    missingExpectedArtifacts: ['HANDOFF.md']
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.gateResults.find((gate) => gate.name === 'expectedArtifacts').status, 'failed');
});

test('decideStatus returns needs_review when Claude log contains a failure pattern', () => {
  const result = decideStatus({
    testsPassed: true,
    timedOut: false,
    claudeExitCode: 0,
    policyResult: {
      pathViolations: [],
      sensitiveChanges: [],
      outsideAllowed: []
    },
    changedFilesCount: 1,
    changedFiles: ['src/app.js'],
    diffLineCount: 10,
    limits: { maxChangedFiles: 10, maxDiffLines: 1000 },
    requireChanges: true,
    claudeLog: 'I need permission before editing this file.',
    failureLogPatterns: ['need permission']
  });

  assert.equal(result.status, 'needs_review');
  assert.equal(result.gateResults.find((gate) => gate.name === 'failureLogPatterns').status, 'failed');
});

test('decideStatus returns blocked when blocked paths are present', () => {
  const result = decideStatus({
    testsPassed: true,
    timedOut: false,
    claudeExitCode: 0,
    policyResult: {
      pathViolations: [{ file: '.env', rule: 'blockedPaths', severity: 'block' }],
      sensitiveChanges: [],
      outsideAllowed: []
    },
    changedFilesCount: 1,
    changedFiles: ['.env'],
    diffLineCount: 1,
    limits: { maxChangedFiles: 10, maxDiffLines: 1000 },
    requireChanges: true
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.ok, false);
  assert.equal(result.gateResults.find((gate) => gate.name === 'blockedPaths').severity, 'block');
});
