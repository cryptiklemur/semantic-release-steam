import plugin from '../index.mjs';

await plugin.verifyConditions(
  {
    appId: process.env.STEAM_APP_ID ?? '294100',
    branchTargets: { main: 'stable', beta: 'beta' },
    mods: [
      { name: 'ExampleMod', path: '.', workshopIds: { stable: process.env.EXAMPLE_STABLE, beta: process.env.EXAMPLE_BETA } },
    ],
  },
  {
    branch: { name: process.env.BRANCH_NAME ?? 'beta' },
    env: process.env,
    logger: console,
  },
);

console.log('steam release config ok');
