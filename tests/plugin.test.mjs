import test from 'node:test';
import assert from 'node:assert/strict';
import plugin from '../index.mjs';

test('publish skips unsupported branches', async () => {
  const result = await plugin.publish(
    {
      appId: '294100',
      branchTargets: { main: 'stable', beta: 'beta' },
      mods: [],
    },
    {
      branch: { name: 'alpha' },
      env: {},
      nextRelease: { version: '2.0.0-alpha.1', notes: '' },
      logger: { log() {} },
    },
  );

  assert.equal(result, undefined);
});

test('publish compiles README and passes the branch asset base URL to the description builder', async () => {
  const descriptionCalls = [];
  const readmeCalls = [];
  const uploadCalls = [];

  const result = await plugin.publish(
    {
      appId: '294100',
      branchTargets: { beta: 'beta' },
      descriptionHeader: 'Header',
      descriptionFooter: 'Footer',
      assetBaseUrlTemplate: 'https://raw.githubusercontent.com/me/my-mod/{branch}',
      mods: [
        {
          name: 'MyMod',
          path: 'MyMod',
          workshopIds: { beta: '123' },
        },
      ],
    },
    {
      branch: { name: 'beta' },
      cwd: '/repo',
      env: {
        STEAM_USERNAME: 'steam-user',
        STEAM_CONFIG_VDF: '/tmp/config.vdf',
      },
      nextRelease: { version: '2.0.0-beta.1', notes: '' },
      logger: { log() {} },
      writeCompiledReadme: async options => {
        readmeCalls.push(options);
      },
      buildSteamDescription: async options => {
        descriptionCalls.push(options);
        return 'built description';
      },
      stageModContent: async () => '/tmp/stage',
      uploadWorkshopItem: async options => {
        uploadCalls.push(options);
      },
    },
  );

  assert.equal(result, undefined);
  assert.deepEqual(readmeCalls, [
    {
      modPath: '/repo/MyMod',
      header: 'Header',
      footer: 'Footer',
      assetDirNameTransform: undefined,
    },
  ]);
  assert.deepEqual(descriptionCalls, [
    {
      modPath: '/repo/MyMod',
      assetBaseUrl: 'https://raw.githubusercontent.com/me/my-mod/beta',
    },
  ]);
  assert.equal(uploadCalls.length, 1);
  assert.equal(uploadCalls[0].appId, '294100');
  assert.equal(uploadCalls[0].publishedFileId, '123');
});

test('publish forwards a custom assetDirNameTransform to compileReadme', async () => {
  const readmeCalls = [];
  const transform = modPath => ['custom', 'fallback'];

  await plugin.publish(
    {
      appId: '500',
      branchTargets: { main: 'stable' },
      assetDirNameTransform: transform,
      mods: [
        { name: 'X', path: 'X', workshopIds: { stable: '99' } },
      ],
    },
    {
      branch: { name: 'main' },
      cwd: '/repo',
      env: { STEAM_USERNAME: 'u', STEAM_CONFIG_VDF: '/cv' },
      nextRelease: { version: '1.0.0', notes: '' },
      logger: { log() {} },
      writeCompiledReadme: async options => { readmeCalls.push(options); },
      buildSteamDescription: async () => 'd',
      stageModContent: async () => '/s',
      uploadWorkshopItem: async () => undefined,
    },
  );

  assert.equal(readmeCalls[0].assetDirNameTransform, transform);
});
