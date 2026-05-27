import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSteamConfigPath } from '../lib/config.mjs';

test('resolveSteamConfigPath prefers STEAM_CONFIG_VDF when set', async () => {
  const result = await resolveSteamConfigPath({
    STEAM_CONFIG_VDF: '/explicit/path/config.vdf',
    STEAM_CONFIG_VDF_B64: Buffer.from('decoy').toString('base64'),
  });

  assert.equal(result, '/explicit/path/config.vdf');
});

test('resolveSteamConfigPath decodes STEAM_CONFIG_VDF_B64 to a temp file', async () => {
  const contents = '"InstallConfigStore" { "Software" {} }';
  const result = await resolveSteamConfigPath({
    STEAM_CONFIG_VDF_B64: Buffer.from(contents).toString('base64'),
  });

  assert.match(result, /config\.vdf$/);
  assert.equal(readFileSync(result, 'utf8'), contents);
});

test('resolveSteamConfigPath returns null when neither env var is set', async () => {
  assert.equal(await resolveSteamConfigPath({}), null);
  assert.equal(await resolveSteamConfigPath({ STEAM_CONFIG_VDF: '', STEAM_CONFIG_VDF_B64: '' }), null);
});
