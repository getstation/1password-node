import * as child_process from 'child_process';
import { ForkOptions } from 'child_process';
import * as Fuse from 'fuse.js';
import * as memoize from 'memoizee';
import { QueryError, SessionError } from './errors';
import {
  downloadBinary,
  isBinaryDownloaded,
  getExecutablePath,
} from './exectubable-downloader';

// CLI Version

const opCliVersion = '0.5.7';

// Memoization

const memoizationConfiguration = {
  maxAge: 6500,
};

// Authentication

export type Credentials = {
  domain: string,
  email: string,
  secretKey: string,
  masterPassword: string,
}

export type Session = {
  token: string,
  email: string,
  expiresAt: Date,
  binaryFolder: string,
}

function escapeShellArg(arg: string) {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export const setupOpBinary = async (
  binaryFolder: string,
): Promise<void> => {
  const alreadyDownloaded = await isBinaryDownloaded(binaryFolder, opCliVersion, process.platform);

  if (!alreadyDownloaded) {
    await downloadBinary(binaryFolder, opCliVersion, process.platform)
  }
}

export async function getSessionToken(
  credentials: Credentials,
  binaryFolder: string
): Promise<Session> {
  const { domain, email, secretKey, masterPassword } = credentials;
  const token = await exec(`signin ${domain} ${email} ${secretKey} --output=raw`, { before: `echo ${escapeShellArg(masterPassword)}`, raw: true, binaryFolder });

  return {
    token,
    email,
    expiresAt: generateTokenExpirationDate(),
    binaryFolder,
  }

}

export function isValidSession(session: Session): boolean {
  return session.expiresAt.getTime() > Date.now();
}

// Account

export type Account = {
  uuid: string,
  name: string,
  avatarUrl: string,
  baseAvatarURL: string,
  createdAt: Date,
}

export const getAccount = memoize(async function (session: Session): Promise<Account> {
  const account = await exec('get account', { session });

  return {
    uuid: account.uuid,
    name: account.name,
    avatarUrl: `${account.baseAvatarURL}${account.uuid}/${account.avatar}`,
    baseAvatarURL: `${account.baseAvatarURL}${account.uuid}`,
    createdAt: new Date(account.createdAt),
  }
}, memoizationConfiguration);

// User

export type User = {
  uuid: string,
  firstName: string,
  lastName: string,
  email: string,
  avatarUrl: string,
}

export type UserDetails = User & {
  language: string,
  createdAt: Date,
  updatedAt: Date,
  lastAuthAt: Date,
}

export const getUsers = memoize(async function (session: Session): Promise<User[]> {
  const users = await exec('list users', { session });
  const account = await getAccount(session);

  return users.map(function (user: User): User {
    const { uuid, firstName, lastName, email } = user;
    const avatarUrl = userAvatarUrl(user, account);

    return {
      uuid,
      firstName,
      lastName,
      email,
      avatarUrl,
    }
  });
}, memoizationConfiguration);

export const getUser = memoize(async function (session: Session, id: string): Promise<UserDetails> {
  const user = await exec(`get user ${id}`, { session });
  const account = await getAccount(session);

  const { uuid, firstName, lastName, email, language,
    createdAt, updatedAt, lastAuthAt } = user;

  return {
    uuid,
    firstName,
    lastName,
    email,
    language,
    avatarUrl: userAvatarUrl(user, account),
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    lastAuthAt: new Date(lastAuthAt),
  }
}, memoizationConfiguration);

function userAvatarUrl(user: any, account: Account): string {
  return user.avatar.length > 0 ?
    `${account.baseAvatarURL}/${user.avatar}` :
    'https://a.1password.com/app/images/avatar-person-default.png';
}

// Template

export type Template = {
  uuid: string,
  name: string,
}

export const getTemplates = memoize(async function (session: Session): Promise<Template[]> {
  return await exec('list templates', { session });
}, memoizationConfiguration);

// Vault

export type Vault = {
  uuid: string,
  name: string,
}

export type VaultDetails = Vault & {
  description: string,
  avatarUrl: string,
}

export async function getVaults(session: Session): Promise<Vault[]> {
  return await exec('list vaults', { session });
}

export const getVault = memoize(async function (session: Session, id: string): Promise<VaultDetails> {
  const vault = await exec(`get vault ${id}`, { session });
  const account = await getAccount(session);
  const { uuid, name, desc } = vault;

  let avatarUrl;

  if (vault.type === 'P') {
    const user = await getUser(session, session.email);
    avatarUrl = user.avatarUrl;
  } else if (vault.type === 'E') {
    avatarUrl = account.avatarUrl;
  } else if (vault.avatar) {
    avatarUrl = `${account.baseAvatarURL}/${vault.avatar}`;
  } else {
    avatarUrl = 'https://a.1password.com/app/images/avatar-vault-default.png';
  }

  return {
    uuid,
    name,
    description: desc,
    avatarUrl,
  }
}, memoizationConfiguration);

// Item

export type BaseItem = {
  uuid: string,
  vault: VaultDetails,
  template: Template,
  title: string,
}

export type LoginItem = BaseItem & {
  username: string,
  password?: string,
}

export type Item = BaseItem | LoginItem

export type ItemsOptions = {
  vault?: Vault,
  template?: Template,
  query?: string | undefined,
  fuse?: Fuse.FuseOptions,
}

const defaultItemsOptions = {
  vault: undefined,
  template: undefined,
  query: undefined,
  fuse: {},
};

export const getItems = memoize(async function (session: Session,
  options: ItemsOptions = defaultItemsOptions): Promise<Item[]> {
  const items = await exec('list items', { session, vault: options.vault });

  if (!options.query) return await trim(session, items, options.template) as Item[];

  const fuseOptions = Object.assign({
    shouldSort: true,
    threshold: 0.15,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [
      "uuid",
      "vaultUuid",
      "overview.ainfo",
      "overview.title",
      "overview.url",
    ]
  }, options.fuse);

  const filteredAccounts = new Fuse(items, fuseOptions).search(options.query);

  return await trim(session, filteredAccounts, options.template) as Item[];
}, memoizationConfiguration);

export const getItem = memoize(async function (session: Session, id: string): Promise<Item> {
  const item = await exec(`get item ${id}`, { session });

  return await trim(session, item) as Item;
}, memoizationConfiguration);

async function trim(session: Session, data: Array<any> | any, template: Template | undefined = undefined): Promise<Item[] | Item> {
  const format = async function (item: any) {
    const { uuid, vaultUuid, templateUuid, overview: { title } } = item;
    const vault = await getVault(session, vaultUuid);
    const templates = await getTemplates(session);
    const template = templates.find(function (template: Template) {
      return template.uuid === templateUuid;
    }) as Template;

    return Object.assign({},
      {
        uuid,
        vault,
        template,
        title,
      }, mapper(item, template));
  };

  if (Array.isArray(data)) {
    return await Promise.all(data
      .filter(function (item: any) {
        if (template) {
          return item.template.uuid === template.uuid;
        } else {
          return true;
        }
      })
      .map(async item => await format(item)));
  } else {
    return await format(data);
  }
}

function mapper(item: any, template: Template): any {
  switch (template.uuid) {
    // Login
    case '001':
      if (item.details && item.details.fields) {
        const passwordFieldFromName = item.details.fields.find(function (field: any) {
          return field.name && field.name.toLowerCase() === 'password' && field.type === 'P';
        });
        const passwordFieldFromDesignation = item.details.fields.find(function (field: any) {
          return field.designation && field.designation.toLowerCase() === 'password' && field.type === 'P';
        });

        const password = passwordFieldFromName ?
          passwordFieldFromName.value : (passwordFieldFromDesignation ? passwordFieldFromDesignation.value : undefined);

        return {
          username: item.overview.ainfo,
          password: password,
        };
      } else {
        return {
          username: item.overview.ainfo,
        };
      }
    default: { }
  }
}

// Engine

type ExecOptions = {
  session?: Session,
  vault?: Vault,
  raw?: boolean,
  before?: string,
  binaryFolder?: string,
}

async function exec(
  command: string,
  options: ExecOptions = {}
): Promise<any> {
  const defaultOptions: ExecOptions = {
    session: undefined,
    vault: undefined,
    raw: false,
    before: '',
    binaryFolder: undefined,
  };

  const { session, vault, raw, before, binaryFolder } = Object.assign(defaultOptions, options);

  let args = command.split(' ');

  if (session) {
    if (isValidSession(session)) {
      args.push(`--session=${session.token}`);
    } else {
      throw new SessionError('Session invalid');
    }
  }

  if (vault) args.push(`--vault=${vault.name}`);

  const definedBinaryFolder = binaryFolder || (session && session.binaryFolder);

  const binaryDownloaded = await isBinaryDownloaded(definedBinaryFolder!, opCliVersion, process.platform);

  if (!binaryDownloaded) {
    await downloadBinary(definedBinaryFolder!, opCliVersion, process.platform);
  }

  const opPath = getExecutablePath(definedBinaryFolder!, opCliVersion, process.platform);

  const result = await forkBin(`${__dirname}/bin`, [opPath, args, before], { silent: true }) as string;

  // Error handling

  // [LOG] XXXX/XX/XX XX:XX:XX (ERROR) Item 3142134123412412 not found
  // [LOG] XXXX/XX/XX XX:XX:XX (ERROR) You are not currently signed in. Please run `op signin --help` for instructions
  // [LOG] XXXX/XX/XX XX:XX:XX (ERROR) 401: Authentication required.

  if (result.includes('[bin-error]')) {
    const error = result
      .split('[bin-error]---')[1];

    if (error.includes('You are not currently signed in.') || error.includes('401: Authentication required')) {
      throw new SessionError(error);
    } else {
      throw new QueryError(error);
    }
  }

  if (raw) return result;

  return JSON.parse(result);
}

async function forkBin(command: string, args: Array<any>, options: ForkOptions) {
  return new Promise((resolve, reject) => {
    let buffers: Buffer[] = [];

    const child = child_process.fork(command, args, options);

    if (child.stdout !== null) {
      child.stdout.on('data', data => {
        if (Buffer.isBuffer(data)) {
          buffers.push(data);
        } else if (typeof data === 'string') {
          buffers.push(Buffer.from(data, 'utf-8'));
        }
      });
    }

    child.on('close', () => {
      resolve(Buffer.concat(buffers).toString('utf-8').trim());
    });

    child.on('error', reject);
  });
}

function generateTokenExpirationDate(): Date {
  const now = new Date();
  return new Date(now.setMinutes(now.getMinutes() + 29));
}
