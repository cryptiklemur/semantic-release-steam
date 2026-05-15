import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSteamDescription } from '../lib/description.mjs';
import { writeCompiledReadme } from '../lib/readme.mjs';

test('returns fallback description when README is missing', async () => {
  const fixturePath = new URL('./fixtures/mod', import.meta.url).pathname;
  const description = await buildSteamDescription({ modPath: fixturePath });
  assert.equal(description, 'No description available.');
});

test('buildSteamDescription renders README images with steamdown img tags', async () => {
  const rootPath = mkdtempSync(join(tmpdir(), 'steam-description-'));
  const modPath = join(rootPath, 'MyMod');
  const binPath = join(rootPath, 'bin');
  const originalPath = process.env.PATH;

  mkdirSync(modPath, { recursive: true });
  mkdirSync(binPath, { recursive: true });

  writeFileSync(join(modPath, 'README.md'), '![Introduction](../.github/assets/mymod/intro.png)\n\nBody\n');
  writeFileSync(
    join(binPath, 'steamdown'),
    "#!/usr/bin/env node\nprocess.stdout.write('[img]https://example.com/.github/assets/mymod/intro.png[/img]\\n\\nBody\\n');\n",
  );
  chmodSync(join(binPath, 'steamdown'), 0o755);

  process.env.PATH = `${binPath}:${originalPath}`;

  try {
    const description = await buildSteamDescription({
      modPath,
      assetBaseUrl: 'https://example.com',
    });
    assert.equal(
      description,
      '[img]https://example.com/.github/assets/mymod/intro.png[/img]\n\nBody\n',
    );
  } finally {
    process.env.PATH = originalPath;
  }
});

test('buildSteamDescription keeps an image after a zero-width-space separator', async () => {
  const rootPath = mkdtempSync(join(tmpdir(), 'steam-description-boundary-'));
  const modPath = join(rootPath, 'MyMod');
  const binPath = join(rootPath, 'bin');
  const originalPath = process.env.PATH;

  mkdirSync(join(rootPath, '.github', 'assets', 'mymod'), { recursive: true });
  mkdirSync(modPath, { recursive: true });
  mkdirSync(binPath, { recursive: true });

  writeFileSync(join(modPath, 'README.template.md'), '![About](../.github/assets/mymod/about.png)\n');
  writeFileSync(join(rootPath, '.github', 'assets', 'mymod', 'intro.png'), '');
  writeFileSync(join(rootPath, '.github', 'assets', 'mymod', 'about.png'), '');
  writeFileSync(
    join(binPath, 'steamdown'),
    "#!/usr/bin/env node\nlet input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{if(input.includes('\\n​\\n\\n![About](')){process.stdout.write('[img]https://example.com/.github/assets/mymod/intro.png[/img]\\n​\\n\\n[img]https://example.com/.github/assets/mymod/about.png[/img]\\n');return;}process.stdout.write('[img]https://example.com/.github/assets/mymod/intro.png[/img]\\n​\\n![url=https://example.com/.github/assets/mymod/about.png]About[/url]\\n');});\n",
  );
  chmodSync(join(binPath, 'steamdown'), 0o755);

  process.env.PATH = `${binPath}:${originalPath}`;

  try {
    await writeCompiledReadme({
      modPath,
      header: '![Introduction](../.github/assets/fallback/intro.png)',
      footer: '',
    });

    const description = await buildSteamDescription({
      modPath,
      assetBaseUrl: 'https://example.com',
    });

    assert.equal(
      description,
      '[img]https://example.com/.github/assets/mymod/intro.png[/img]\n​\n\n[img]https://example.com/.github/assets/mymod/about.png[/img]\n',
    );
  } finally {
    process.env.PATH = originalPath;
  }
});
