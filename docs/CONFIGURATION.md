# Configuration

Each target project must define `supervisor.config.json` at its root.

## Example

```json
{
  "claudeCommand": "claude",
  "permissionMode": "acceptEdits",
  "allowedTools": [
    "Read",
    "Edit",
    "Bash(git status *)",
    "Bash(git diff *)",
    "Bash(npm test *)"
  ],
  "stages": {
    "stage-001": {
      "promptFile": "CLAUDE_PROMPT.md",
      "timeoutMinutes": 30,
      "requireChanges": true,
      "testCommands": ["npm test"]
    }
  },
  "pathPolicy": {
    "allowedPaths": ["src/**", "test/**", "docs/**", "README.md", "package.json"],
    "blockedPaths": [".env", ".env.*", "secrets/**", ".git/**"],
    "sensitivePaths": ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "docker-compose.yml"]
  },
  "limits": {
    "maxChangedFiles": 30,
    "maxDiffLines": 1200
  }
}
```

## Top-Level Fields

### `claudeCommand`

Command used to invoke Claude Code. Default: `claude`.

For deterministic test scenarios, this may point to a fake Claude script.

### `permissionMode`

Passed to Claude Code as `--permission-mode`. Default: `acceptEdits`.

### `allowedTools`

Passed to Claude Code as `--allowedTools`.

### `stages`

Map of stage names to stage config.

Each stage supports:

- `promptFile`: prompt file path relative to the target project root.
- `timeoutMinutes`: maximum runtime for the Claude process.
- `requireChanges`: whether zero changed files should force `needs_review`. Default: `true`.
- `testCommands`: shell commands run after Claude exits.

### `pathPolicy`

Controls which paths are allowed, sensitive, or blocked.

- `allowedPaths`: files outside this list force `needs_review`.
- `blockedPaths`: matching files force `blocked`.
- `sensitivePaths`: matching files force `needs_review`.

Patterns support `*` and `**` glob-style matching.

### `limits`

Controls diff size risk thresholds.

- `maxChangedFiles`
- `maxDiffLines`

Exceeding either threshold returns `needs_review`.

## Recommended Policy Defaults

Block:

```json
[".env", ".env.*", "secrets/**", ".git/**"]
```

Review:

```json
["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "docker-compose.yml"]
```

Allow only the specific module paths for high-risk bug fixes or existing frontend feature work.
