import { PlatformNotSupportedError } from './errors';

const table: Record<string, string> = {
  darwin: 'op-darwin-41001',
  win32: 'op-win-41001.exe',
  linux: 'op-linux-x64-41001',
};

export function getExecutableName(platform: string) {
  if (platform in table) {
    return table[platform];
  }
  throw new PlatformNotSupportedError(`Platform ${platform} is not yet supported`)
}

export default table;
