import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkshopVdf } from '../lib/vdf.mjs';

test('renders workshop.vdf with required fields and changenote+description', () => {
  const vdf = createWorkshopVdf({
    appId: '294100',
    publishedFileId: '123456',
    contentFolder: '/tmp/CosmereCore',
    changenote: '2.0.0-beta.1',
    description: 'Steam description',
  });

  assert.match(vdf, /"appid" "294100"/);
  assert.match(vdf, /"publishedfileid" "123456"/);
  assert.match(vdf, /"contentfolder" "\/tmp\/CosmereCore"/);
  assert.match(vdf, /"changenote" "2.0.0-beta.1"/);
  assert.match(vdf, /"description" "Steam description"/);
});

test('escapes quotes in changenote and description', () => {
  const vdf = createWorkshopVdf({
    appId: '294100',
    publishedFileId: '123456',
    contentFolder: '/tmp/CosmereCore',
    changenote: 'note "quoted"',
    description: 'desc "quoted"',
  });

  assert.match(vdf, /note \\"quoted\\"/);
  assert.match(vdf, /desc \\"quoted\\"/);
});

test('omits optional fields when not set', () => {
  const vdf = createWorkshopVdf({
    appId: '1',
    publishedFileId: '2',
    contentFolder: '/c',
  });

  assert.doesNotMatch(vdf, /"title"/);
  assert.doesNotMatch(vdf, /"previewfile"/);
  assert.doesNotMatch(vdf, /"visibility"/);
  assert.doesNotMatch(vdf, /"tags"/);
  assert.doesNotMatch(vdf, /"description"/);
  assert.doesNotMatch(vdf, /"changenote"/);
});

test('emits title, previewfile, visibility=0, and tags when set', () => {
  const vdf = createWorkshopVdf({
    appId: '1',
    publishedFileId: '2',
    contentFolder: '/c',
    title: 'My Mod',
    previewfile: '/p/preview.png',
    visibility: 0,
    tags: ['QoL', 'Mod'],
  });

  assert.match(vdf, /"title" "My Mod"/);
  assert.match(vdf, /"previewfile" "\/p\/preview\.png"/);
  assert.match(vdf, /"visibility" "0"/);
  assert.match(vdf, /"tags"\n\s*\{/);
  assert.match(vdf, /"0" "QoL"/);
  assert.match(vdf, /"1" "Mod"/);
});

test('emits all four visibility levels distinctly', () => {
  for (const v of [0, 1, 2, 3]) {
    const vdf = createWorkshopVdf({
      appId: '1', publishedFileId: '2', contentFolder: '/c', visibility: v,
    });
    assert.match(vdf, new RegExp(`"visibility" "${v}"`));
  }
});
