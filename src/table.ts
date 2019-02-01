import { PlatformNotSupportedError } from './errors';

const table: Record<string, string> = {
  darwin: 'op-darwin-55001',
  linux: 'op-linux-x64-55001',
  win32: 'op-win-55001.exe',
};

export function getExecutableName(platform: string) {
  if (platform in table) {
    return table[platform];
  }
  throw new PlatformNotSupportedError(`Platform ${platform} is not yet supported`);
}

export default table;
