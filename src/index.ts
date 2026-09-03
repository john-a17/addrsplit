#!/usr/bin/env node
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { parseAddress } from './parse';

const HELP = `addrsplit - split single-line postal addresses into fields

Usage:
  addrsplit                 read addresses from stdin, one per line
  addrsplit --file PATH     read addresses from a file instead of stdin

Each input line becomes one line of JSON on stdout:
  {"raw":"...","street":"...","unit":null,"city":"...","state":"..","zip":"...","zip4":null,"valid":true}

Input is read and written line by line, so file size is not bounded by
available memory.
`;

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }

  let input: NodeJS.ReadableStream = process.stdin;
  const fileFlagIndex = args.indexOf('--file');
  if (fileFlagIndex !== -1) {
    const path = args[fileFlagIndex + 1];
    if (!path) {
      process.stderr.write('addrsplit: --file requires a path\n');
      process.exitCode = 1;
      return;
    }
    input = fs.createReadStream(path, { encoding: 'utf8' });
  }

  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  rl.on('line', (line) => {
    if (line.trim().length === 0) {
      return;
    }
    const parsed = parseAddress(line);
    process.stdout.write(JSON.stringify(parsed) + '\n');
  });

  rl.on('error', (err) => {
    process.stderr.write(`addrsplit: ${err.message}\n`);
    process.exitCode = 1;
  });
}

main();
