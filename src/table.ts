import { PlatformNotSupportedError } from './errors';

const table: Record<string, string> = {
  darwin: 'op-darwin-57001',
  linux: 'op-linux-x64-57001',
  win32: 'op-win-57001.exe',
};

export function getExecutableName(platform: string) {
  if (platform in table) {
    return table[platform];
  }
  throw new PlatformNotSupportedError(`Platform ${platform} is not yet supported`);
}

export default table;
