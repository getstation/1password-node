import { execSync } from 'child_process';

const [_program, _path, binaryPath, args, before] = process.argv;

let response;

const realBinaryPath = binaryPath.includes('app.asar/') ?
  binaryPath.replace('app.asar/', 'app.asar.unpacked/') : binaryPath;

try {
  const shellArgs = args.split(',').join(' ');

  const command = Boolean(before) ?
    `${before} | ${realBinaryPath} ${shellArgs}` :
    `${realBinaryPath} ${shellArgs}`;

  response = execSync(command)
    .toString()
    .replace(/\n/g, '');
} catch (error) {
  response = '[bin-error]---' + error.stderr.toString();
}

process.stdout.write(response + '\n');
