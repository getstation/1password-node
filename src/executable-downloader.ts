import * as Zip from 'adm-zip';
import * as removeDir from 'del';
import { get } from 'https';
import {
  constants,
  createWriteStream,
  mkdir,
  chmod,
  unlink,
  access,
} from 'fs';
import { ensureDir } from 'fs-extra';
import { join } from 'path';
import { promisify } from 'util';

import { PlatformNotSupportedError } from './errors';

const makeExecutable = promisify(chmod);
const removeFile = promisify(unlink);

const table: Record<string, string> = {
  darwin: 'darwin_amd64',
  linux: 'linux_amd64',
  win32: 'windows_amd64',
};

export const getExecutablePath = (
  destination: string,
  version: string,
  platform: NodeJS.Platform
): string => {
  const folderDestination = `${destination}-${version}`;
  const executableName = platform === 'win32' ? 'op.exe' : 'op';

  return join(folderDestination, executableName);
}

const getDistributionPlatform = (platform: NodeJS.Platform) => {
  if (platform in table) {
    return table[platform];
  }

  throw new PlatformNotSupportedError(`Platform ${platform} is not yet supported`);
}

const urlFor = (version: string, platform: string) =>
  `https://cache.agilebits.com/dist/1P/op/pkg/v${version}/op_${platform}_v${version}.zip`;

export const downloadBinary = async (
  destination: string,
  version: string,
  platform: NodeJS.Platform
): Promise<string> =>
  new Promise(async (resolve, reject) => {
    const zipDestination = `${destination}-${version}.zip`;
    const folderDestination = `${destination}-${version}`;
    const executablePath = getExecutablePath(destination, version, platform);

    await ensureDir(folderDestination);

    const file = createWriteStream(zipDestination);

    await removeDir(folderDestination, { force: true });

    get(urlFor(version, getDistributionPlatform(platform)), (response) => {
      response.pipe(file);

      response.on('error', () => reject());
    });

    file.on('finish', async () => {
      file.close();

      const zipFile = new Zip(zipDestination);
      zipFile.extractAllTo(folderDestination);

      await makeExecutable(executablePath, 0o755)

      await removeFile(zipDestination);

      return resolve(executablePath);
    });
  });

export const isBinaryDownloaded = (
  destination: string,
  version: string,
  platform: NodeJS.Platform
): Promise<boolean> =>
  new Promise(
    async (resolve, reject) =>
      access(getExecutablePath(destination, version, platform), constants.F_OK, (error) => {
        if (error) return resolve(false);

        return resolve(true);
      })
  );;
