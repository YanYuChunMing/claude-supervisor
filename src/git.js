import { runCommand } from './processUtils.js';

function extractPathFromPorcelainLine(line) {
  const trimmed = line.trimEnd();
  if (!trimmed || trimmed.length < 4) {
    return null;
  }

  const payload = trimmed.slice(3).trim();
  if (!payload) {
    return null;
  }

  // Rename format: "old/path -> new/path"
  if (payload.includes(' -> ')) {
    const parts = payload.split(' -> ');
    return parts[parts.length - 1].trim();
  }

  return payload;
}

export function collectPathsFromPorcelain(statusOutput) {
  return statusOutput
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(extractPathFromPorcelainLine)
    .filter(Boolean);
}

export async function collectGitStatus(projectDir) {
  const status = await runCommand('git', ['status', '--porcelain'], { cwd: projectDir });
  const diffNames = await runCommand('git', ['diff', '--name-only'], { cwd: projectDir });
  const diff = await runCommand('git', ['diff'], { cwd: projectDir });

  const statusPaths = collectPathsFromPorcelain(status.stdout);
  const diffPaths = diffNames.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const changedFiles = [
    ...new Set([...statusPaths, ...diffPaths])
  ].filter((file) => !file.startsWith('.supervisor/'));

  return {
    status,
    diffNames,
    diff,
    changedFiles,
    diffLineCount: diff.stdout ? diff.stdout.split(/\r?\n/).length : 0
  };
}
