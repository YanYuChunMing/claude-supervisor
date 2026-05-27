import { access, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, getStage } from './config.js';
import { runCommand, runShellCommand } from './processUtils.js';
import { collectGitStatus } from './git.js';
import { evaluatePathPolicy } from './pathPolicy.js';
import { decideStatus, writeReviewArtifacts } from './report.js';

function makeRunId(stageName, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  return `${stamp}-${stageName}`;
}

function buildClaudeArgs(config, promptFile, project) {
  const prompt = `Read and follow the supervisor stage prompt file. Prompt file path: ${promptFile}. Project path: ${project}. Work only inside the project path.`;
  const args = ['-p', prompt, '--permission-mode', config.permissionMode];
  if (config.allowedTools?.length) {
    args.push('--allowedTools', config.allowedTools.join(','));
  }
  return args;
}

async function findMissingArtifacts(project, artifacts = []) {
  const missing = [];

  for (const artifact of artifacts) {
    const artifactPath = path.resolve(project, artifact);
    try {
      await access(artifactPath);
    } catch {
      missing.push(artifact);
    }
  }

  return missing;
}

async function runTests(projectDir, commands, testsLog) {
  const results = [];
  let log = '';

  for (const command of commands) {
    log += `\n$ ${command}\n`;
    const result = await runShellCommand(command, { cwd: projectDir });
    log += result.stdout;
    log += result.stderr;
    results.push({ command, exitCode: result.exitCode, timedOut: result.timedOut });
  }

  await writeFile(testsLog, log.trimStart());
  return results;
}

export async function runStage({ projectDir, stageName }) {
  const project = path.resolve(projectDir);
  const config = await loadConfig(project);
  const stage = getStage(config, stageName);
  const runDir = path.join(project, '.supervisor', 'runs', makeRunId(stageName));
  await mkdir(runDir, { recursive: true });

  const claudeLog = path.join(runDir, 'claude.log');
  const testsLog = path.join(runDir, 'tests.log');
  const diffFile = path.join(runDir, 'diff.patch');
  const effectivePromptFile = path.join(runDir, 'effective-prompt.md');

  const prompt = await readFile(stage.promptFile, 'utf8');
  await writeFile(effectivePromptFile, prompt);

  let claudeOutput = '';
  const claudeResult = await runCommand(config.claudeCommand, buildClaudeArgs(config, effectivePromptFile, project), {
    cwd: project,
    shell: process.platform === 'win32',
    timeoutMs: stage.timeoutMinutes * 60 * 1000,
    env: {
      SUPERVISOR_PROJECT_DIR: project,
      SUPERVISOR_RUN_DIR: runDir,
      SUPERVISOR_STAGE: stageName,
      SUPERVISOR_PROMPT_FILE: effectivePromptFile
    },
    onStdout: (text) => {
      claudeOutput += text;
    },
    onStderr: (text) => {
      claudeOutput += text;
    }
  });
  await writeFile(claudeLog, claudeOutput);

  const testResults = await runTests(project, stage.testCommands ?? [], testsLog);
  const testsPassed = testResults.every((result) => result.exitCode === 0 && !result.timedOut);

  const gitStatus = await collectGitStatus(project);
  await writeFile(diffFile, gitStatus.diff.stdout);

  const policyResult = evaluatePathPolicy(gitStatus.changedFiles, config.pathPolicy);
  const missingExpectedArtifacts = await findMissingArtifacts(project, stage.expectedArtifacts);
  const decision = decideStatus({
    testsPassed,
    timedOut: claudeResult.timedOut,
    claudeExitCode: claudeResult.exitCode,
    policyResult,
    changedFiles: gitStatus.changedFiles,
    changedFilesCount: gitStatus.changedFiles.length,
    diffLineCount: gitStatus.diffLineCount,
    limits: config.limits,
    requireChanges: stage.requireChanges,
    requiredChangedPaths: stage.requiredChangedPaths,
    expectedArtifacts: stage.expectedArtifacts,
    missingExpectedArtifacts,
    claudeLog: claudeOutput,
    failureLogPatterns: stage.failureLogPatterns
  });

  const failedGates = decision.gateResults.filter((gate) => gate.status === 'failed');
  const blockedGates = failedGates.filter((gate) => gate.severity === 'block');

  const summary = {
    ok: decision.ok,
    project,
    stage: stageName,
    status: decision.status,
    runDir,
    timedOut: claudeResult.timedOut,
    claudeExitCode: claudeResult.exitCode,
    testsPassed,
    changedFiles: gitStatus.changedFiles.length,
    pathViolations: policyResult.pathViolations.length,
    sensitiveChanges: policyResult.sensitiveChanges.length,
    failedGates: failedGates.length,
    blockedGates: blockedGates.length,
    reviewFile: path.join(runDir, 'REVIEW_REQUEST.md'),
    statusFile: path.join(runDir, 'status.json'),
    diffFile,
    logFile: claudeLog
  };

  const details = {
    changedFiles: gitStatus.changedFiles,
    policyResult,
    testResults,
    git: {
      statusExitCode: gitStatus.status.exitCode,
      diffExitCode: gitStatus.diff.exitCode,
      diffLineCount: gitStatus.diffLineCount
    },
    logs: {
      claudeLog,
      testsLog,
      diffFile,
      effectivePromptFile
    },
    gateResults: decision.gateResults,
    expectedArtifacts: {
      configured: stage.expectedArtifacts,
      missing: missingExpectedArtifacts
    }
  };

  await writeReviewArtifacts(runDir, summary, details);
  return summary;
}
