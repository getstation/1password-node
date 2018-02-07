import { execFileSync } from 'child_process';

const opPath = process.argv[2];
const args = process.argv[3].split(',');

let response;

try {
  response = execFileSync(opPath, args)
    .toString()
    .replace(/\n/g, '');
} catch (error) {
  response = '[bin-error]---' + error.stderr.toString();
}

process.stdout.write(response + '\n');
