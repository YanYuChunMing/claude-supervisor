#!/usr/bin/env node
import { runStage } from './runner.js';

function printHelp() {
  const help = `claude-supervisor

Usage:
  claude-supervisor run --project <path> --stage <stage-name>
  node src/cli.js run --project <path> --stage <stage-name>

Options:
  --project   Target project directory containing supervisor.config.json
  --stage     Stage key from supervisor.config.json
  --help      Show this help
`;
  process.stdout.write(help);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };

  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (item === '--project') {
      args.project = rest[i + 1];
      i += 1;
    } else if (item === '--stage') {
      args.stage = rest[i + 1];
      i += 1;
    } else if (item === '--help' || item === '-h') {
      args.help = true;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command || args.help || args.command === '--help' || args.command === '-h') {
    printHelp();
    return;
  }

  if (args.command !== 'run') {
    throw new Error(`Unknown command "${args.command}"`);
  }

  if (!args.project || !args.stage) {
    throw new Error('Missing required arguments: --project and --stage');
  }

  const summary = await runStage({ projectDir: args.project, stageName: args.stage });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  const payload = {
    ok: false,
    status: 'error',
    error: error.message
  };
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
});
