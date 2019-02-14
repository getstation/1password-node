import { execSync } from 'child_process';

const [_program, _path, binaryPath, args, before] = process.argv;

let response;

try {
  const shellArgs = args.split(',').join(' ');

  const command = Boolean(before) ?
    `${before} | "${binaryPath}" ${shellArgs}` :
    `"${binaryPath}" ${shellArgs}`;

  response = execSync(command)
    .toString()
    .replace(/\n/g, '');
} catch (error) {
  response = '[bin-error]---' + error.stderr.toString();
}

process.stdout.write(response + '\n');
