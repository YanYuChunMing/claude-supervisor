import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function formatList(items, formatter = (item) => `- ${item}`) {
  return items.length ? items.map(formatter).join('\n') : '- None';
}

export async function writeReviewArtifacts(runDir, summary, details) {
  await mkdir(runDir, { recursive: true });

  const statusFile = path.join(runDir, 'status.json');
  const reviewFile = path.join(runDir, 'REVIEW_REQUEST.md');
  const statusPayload = {
    ...summary,
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
  changedFilesCount,
  diffLineCount,
  limits,
  requireChanges
}) {
  if (timedOut || policyResult.pathViolations.length > 0) {
    return { status: 'blocked', ok: false };
  }

  if (
    claudeExitCode !== 0 ||
    !testsPassed ||
    policyResult.sensitiveChanges.length > 0 ||
    policyResult.outsideAllowed.length > 0 ||
    changedFilesCount > limits.maxChangedFiles ||
    diffLineCount > limits.maxDiffLines ||
    (requireChanges && changedFilesCount === 0)
  ) {
    return { status: 'needs_review', ok: false };
  }

  return { status: 'passed', ok: true };
}
