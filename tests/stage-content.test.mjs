import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageModContent } from '../lib/stage-content.mjs';

test('stages mod content while excluding .steamignore matches', async () => {
  const root = mkdtempSync(join(tmpdir(), 'steam-stage-'));
  const modDir = join(root, 'MyMod');
  mkdirSync(join(modDir, 'About'), { recursive: true });
  writeFileSync(join(modDir, 'About', 'About.xml'), '<ModMetaData />');
  writeFileSync(join(modDir, '.steamignore'), 'Secrets.txt\n');
  writeFileSync(join(modDir, 'Secrets.txt'), 'skip me');
  writeFileSync(join(modDir, 'Keep.txt'), 'keep me');

  const stagedPath = await stageModContent({ modPath: modDir });

  assert.equal(existsSync(join(stagedPath, 'Keep.txt')), true);
  assert.equal(existsSync(join(stagedPath, 'Secrets.txt')), false);
});

test('supports gitignore-style negation patterns in .steamignore', async () => {
  const root = mkdtempSync(join(tmpdir(), 'steam-stage-'));
  const modDir = join(root, 'NegMod');
  mkdirSync(join(modDir, '.run'), { recursive: true });
  writeFileSync(join(modDir, '.run', 'config.xml'), '<Config />');
  writeFileSync(join(modDir, 'Keep.txt'), 'keep me');
  writeFileSync(join(modDir, 'Other.txt'), 'skip me');
  writeFileSync(
    join(modDir, '.steamignore'),
    '# comment\n.run/\n*.txt\n!.run/\n!Keep.txt\n',
  );

  const stagedPath = await stageModContent({ modPath: modDir });

  assert.equal(existsSync(join(stagedPath, '.run', 'config.xml')), true);
  assert.equal(existsSync(join(stagedPath, 'Keep.txt')), true);
  assert.equal(existsSync(join(stagedPath, 'Other.txt')), false);
  assert.equal(existsSync(join(stagedPath, '.steamignore')), false);
});

test('stages mod content even without a .steamignore', async () => {
  const root = mkdtempSync(join(tmpdir(), 'steam-stage-'));
  const modDir = join(root, 'BareMod');
  mkdirSync(join(modDir, 'About'), { recursive: true });
  writeFileSync(join(modDir, 'About', 'About.xml'), '<ModMetaData />');
  writeFileSync(join(modDir, 'Keep.txt'), 'keep me');

  const stagedPath = await stageModContent({ modPath: modDir });

  assert.equal(existsSync(join(stagedPath, 'About', 'About.xml')), true);
  assert.equal(existsSync(join(stagedPath, 'Keep.txt')), true);
});
