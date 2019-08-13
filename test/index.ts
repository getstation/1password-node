// @ts-ignore: no declaration file
import * as inquirer from 'inquirer';
import {
  getAccount, getItem, getItems, getSessionToken, getTemplates, getUser,
  getUsers, getVault, getVaults, isValidSession,
} from '../src';

async function test() {
  const credentials = await inquirer
    .prompt([
      {
        type: 'input',
        message: 'Domain',
        name: 'domain',
      },
      {
        type: 'input',
        message: 'Email',
        name: 'email',
      },
      {
        type: 'input',
        message: 'Enter secret key',
        name: 'secretKey',
      },
      {
        type: 'password',
        message: 'Enter master password',
        name: 'masterPassword',
        mask: '*',
      },
    ]);

  const session = await getSessionToken(credentials, './bin/op');
  console.log('session: ', session);
  console.log('---');

  const valid = await isValidSession(session);
  console.log('valid: ', valid);
  console.log('---');

  const account = await getAccount(session);
  console.log('account: ', account);
  console.log('---');

  const users = await getUsers(session);
  console.log('users: ', users);
  console.log('---');

  const user = await getUser(session, users[0].uuid);
  console.log('user: ', user);
  console.log('---');

  const templates = await getTemplates(session);
  console.log('templates: ', templates);
  console.log('---');

  const vaults = await getVaults(session);
  console.log('vaults: ', vaults);
  console.log('---');

  const vault = await getVault(session, vaults[0].uuid);
  console.log('vault: ', vault);
  console.log('---');

  const items = await getItems(session);
  console.log('items: ', items);
  console.log('---');

  const item = await getItem(session, items[0].uuid);
  console.log('item: ', item);
  console.log('---');
}

test();
