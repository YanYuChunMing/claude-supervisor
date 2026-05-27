import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG = {
  claudeCommand: 'claude',
  permissionMode: 'acceptEdits',
  allowedTools: [
    'Read',
    'Edit',
    'Bash(git status *)',
    'Bash(git diff *)'
  ],
  stages: {},
  pathPolicy: {
    allowedPaths: ['**'],
    blockedPaths: ['.env', '.env.*', 'secrets/**', '.git/**'],
    sensitivePaths: ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'docker-compose.yml']
  },
  limits: {
    maxChangedFiles: 30,
    maxDiffLines: 1200
  }
};

export async function loadConfig(projectDir) {
  const root = path.resolve(projectDir);
  const configFile = path.join(root, 'supervisor.config.json');

  try {
    await access(configFile);
  } catch {
    throw new Error(`Missing supervisor config: ${configFile}`);
  }

  const raw = await readFile(configFile, 'utf8');
  const parsed = JSON.parse(raw);
  const config = {
    ...DEFAULT_CONFIG,
    ...parsed,
    pathPolicy: {
      ...DEFAULT_CONFIG.pathPolicy,
      ...(parsed.pathPolicy ?? {})
    },
    limits: {
      ...DEFAULT_CONFIG.limits,
      ...(parsed.limits ?? {})
    },
    stages: parsed.stages ?? {}
  };

  for (const [stageName, stage] of Object.entries(config.stages)) {
    if (!stage.promptFile) {
      throw new Error(`Stage "${stageName}" is missing promptFile`);
    }

    config.stages[stageName] = {
      timeoutMinutes: 30,
      testCommands: [],
      requireChanges: true,
      requiredChangedPaths: [],
      expectedArtifacts: [],
      failureLogPatterns: [],
      ...stage,
      promptFile: path.resolve(root, stage.promptFile)
    };
  }

  return config;
}

export function getStage(config, stageName) {
  const stage = config.stages[stageName];
  if (!stage) {
    throw new Error(`Unknown stage "${stageName}". Available stages: ${Object.keys(config.stages).join(', ') || '(none)'}`);
  }
  return stage;
}
