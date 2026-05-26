import { spawn } from 'node:child_process';

function quoteArgForCmd(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '\\"')}"`;
}

function wrapWindowsShellCommand(command, args) {
  const commandLine = args.length === 0
    ? command
    : `${command} ${args.map((arg) => quoteArgForCmd(arg)).join(' ')}`;
  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', commandLine]
  };
}

export function runCommand(command, args = [], options = {}) {
  const {
    cwd,
    timeoutMs,
    input,
    env = process.env,
    shell = false,
    onStdout,
    onStderr
  } = options;

  return new Promise((resolve) => {
    const spawnTarget = shell && process.platform === 'win32'
      ? wrapWindowsShellCommand(command, args)
      : { command, args };

    const child = spawn(spawnTarget.command, spawnTarget.args, {
      cwd,
      env,
      shell: shell && process.platform !== 'win32',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onStdout?.(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onStderr?.(text);
    });

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: `${stderr}${error.message}`, timedOut });
    });

    child.on('close', (exitCode) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

export function runShellCommand(command, options = {}) {
  return runCommand(command, [], { ...options, shell: true });
}
