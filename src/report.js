import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matchesAny } from './pathPolicy.js';

function formatList(items, formatter = (item) => `- ${item}`) {
  return items.length ? items.map(formatter).join('\n') : '- None';
}

export async function writeReviewArtifacts(runDir, summary, details) {
  await mkdir(runDir, { recursive: true });

  const statusFile = path.join(runDir, 'status.json');
  const reviewFile = path.join(runDir, 'REVIEW_REQUEST.md');
  const gateResults = details.gateResults ?? summary.gateResults ?? [];
  const statusPayload = {
    ...summary,
    gateResults,
    details
  };

  const review = `# Review Request

## Summary
- Project: ${summary.project}
- Stage: ${summary.stage}
- Status: ${summary.status}
- OK: ${summary.ok}
- Timed out: ${summary.timedOut}
- Claude exit code: ${summary.claudeExitCode}
- Tests passed: ${summary.testsPassed}
- Changed files: ${summary.changedFiles}
- Path violations: ${summary.pathViolations}
- Sensitive changes: ${summary.sensitiveChanges}

## Changed Files
${formatList(details.changedFiles)}

## Blocked Path Violations
${formatList(details.policyResult.pathViolations, (item) => `- ${item.file} (${item.rule})`)}

## Sensitive Changes
${formatList(details.policyResult.sensitiveChanges, (item) => `- ${item.file} (${item.rule})`)}

## Outside Allowed Paths
${formatList(details.policyResult.outsideAllowed, (item) => `- ${item.file} (${item.rule})`)}

## Gate Results
${formatList(gateResults, (item) => `- ${item.name}: ${item.status} (${item.severity}) - ${item.evidence}`)}

## Test Results
${formatList(details.testResults, (item) => `- \`${item.command}\`: exit=${item.exitCode}, timedOut=${item.timedOut}`)}

## Artifacts
- Claude log: ${details.logs.claudeLog}
- Tests log: ${details.logs.testsLog}
- Diff file: ${details.logs.diffFile}
- Status file: ${statusFile}
`;

  await writeFile(statusFile, JSON.stringify(statusPayload, null, 2));
  await writeFile(reviewFile, review);

  return { statusFile, reviewFile };
}

export function decideStatus({
  testsPassed,
  timedOut,
  claudeExitCode,
  policyResult,
  changedFiles = [],
  changedFilesCount,
  diffLineCount,
  limits,
  requireChanges,
  requiredChangedPaths = [],
  expectedArtifacts = [],
  missingExpectedArtifacts = [],
  claudeLog = '',
  failureLogPatterns = []
}) {
  const gateResults = [];
  const addGate = (name, passed, severity, evidence) => {
    gateResults.push({
      name,
      status: passed ? 'passed' : 'failed',
      severity,
      evidence
    });
  };

  addGate('timedOut', !timedOut, 'block', timedOut ? 'Claude exceeded the stage timeout' : 'Claude finished before timeout');
  addGate(
    'claudeExitCode',
    claudeExitCode === 0,
    'review',
    `Claude exit code: ${claudeExitCode}`
  );
  addGate(
    'testsPassed',
    testsPassed,
    'review',
    testsPassed ? 'All configured test commands passed' : 'One or more test commands failed'
  );
  addGate(
    'blockedPaths',
    policyResult.pathViolations.length === 0,
    'block',
    policyResult.pathViolations.length
      ? `${policyResult.pathViolations.length} blocked path change(s)`
      : 'No blocked path changes'
  );
  addGate(
    'sensitivePaths',
    policyResult.sensitiveChanges.length === 0,
    'review',
    policyResult.sensitiveChanges.length
      ? `${policyResult.sensitiveChanges.length} sensitive path change(s)`
      : 'No sensitive path changes'
  );
  addGate(
    'outsideAllowedPaths',
    policyResult.outsideAllowed.length === 0,
    'review',
    policyResult.outsideAllowed.length
      ? `${policyResult.outsideAllowed.length} change(s) outside allowed paths`
      : 'All changes are inside allowed paths'
  );
  addGate(
    'requireChanges',
    !requireChanges || changedFilesCount > 0,
    'review',
    requireChanges ? `${changedFilesCount} changed file(s)` : 'Changes are not required for this stage'
  );

  const missingRequiredPaths = requiredChangedPaths.filter((pattern) => !changedFiles.some((file) => matchesAny(file, [pattern])));
  addGate(
    'requiredChangedPaths',
    missingRequiredPaths.length === 0,
    'review',
    missingRequiredPaths.length
      ? `No changed file matched: ${missingRequiredPaths.join(', ')}`
      : requiredChangedPaths.length
        ? 'All required changed path patterns matched'
        : 'No required changed path patterns configured'
  );

  addGate(
    'expectedArtifacts',
    missingExpectedArtifacts.length === 0,
    'review',
    missingExpectedArtifacts.length
      ? `Missing expected artifact(s): ${missingExpectedArtifacts.join(', ')}`
      : expectedArtifacts.length
        ? 'All expected artifacts exist'
        : 'No expected artifacts configured'
  );

  const lowerLog = claudeLog.toLowerCase();
  const matchedFailurePatterns = failureLogPatterns.filter((pattern) => lowerLog.includes(String(pattern).toLowerCase()));
  addGate(
    'failureLogPatterns',
    matchedFailurePatterns.length === 0,
    'review',
    matchedFailurePatterns.length
      ? `Claude log matched failure pattern(s): ${matchedFailurePatterns.join(', ')}`
      : 'Claude log did not match configured failure patterns'
  );

  addGate(
    'maxChangedFiles',
    changedFilesCount <= limits.maxChangedFiles,
    'review',
    `${changedFilesCount}/${limits.maxChangedFiles} changed file(s)`
  );
  addGate(
    'maxDiffLines',
    diffLineCount <= limits.maxDiffLines,
    'review',
    `${diffLineCount}/${limits.maxDiffLines} diff line(s)`
  );

  const failedGates = gateResults.filter((gate) => gate.status === 'failed');
  const blockedGates = failedGates.filter((gate) => gate.severity === 'block');

  if (blockedGates.length > 0) {
    return { status: 'blocked', ok: false, gateResults };
  }

  if (failedGates.length > 0) {
    return { status: 'needs_review', ok: false, gateResults };
  }

  return { status: 'passed', ok: true, gateResults };
}
