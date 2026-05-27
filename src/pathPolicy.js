export function normalizeGitPath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.?\//, '');
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegex(pattern) {
  const normalized = normalizeGitPath(pattern);
  let regex = '^';

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '*' && next === '*') {
      regex += '.*';
      i += 1;
    } else if (char === '*') {
      regex += '[^/]*';
    } else {
      regex += escapeRegex(char);
    }
  }

  regex += '$';
  return new RegExp(regex);
}

export function matchesAny(file, patterns = []) {
  const normalized = normalizeGitPath(file);
  return patterns.some((pattern) => globToRegex(pattern).test(normalized));
}

export function evaluatePathPolicy(changedFiles, policy = {}) {
  const allowedPaths = policy.allowedPaths ?? ['**'];
  const blockedPaths = policy.blockedPaths ?? [];
  const sensitivePaths = policy.sensitivePaths ?? [];

  const result = {
    pathViolations: [],
    sensitiveChanges: [],
    outsideAllowed: []
  };

  for (const rawFile of changedFiles) {
    const file = normalizeGitPath(rawFile);

    if (matchesAny(file, blockedPaths)) {
      result.pathViolations.push({ file, rule: 'blockedPaths', severity: 'block' });
      continue;
    }

    if (matchesAny(file, sensitivePaths)) {
      result.sensitiveChanges.push({ file, rule: 'sensitivePaths', severity: 'review' });
    }

    if (!matchesAny(file, allowedPaths)) {
      result.outsideAllowed.push({ file, rule: 'allowedPaths', severity: 'review' });
    }
  }

  return result;
}
