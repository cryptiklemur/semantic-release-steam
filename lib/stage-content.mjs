import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function buildFilterArgs(content) {
  const rules = [];

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('!')) {
      const pattern = line.slice(1).trim();
      if (pattern) {
        rules.push(`+ ${pattern}`);
      }
      continue;
    }
    rules.push(`- ${line}`);
  }

  // .steamignore is last-match-wins (gitignore semantics); rsync filters are
  // first-match-wins, so reverse the rule order to preserve precedence.
  rules.reverse();

  return rules.map((rule) => `--filter=${rule}`);
}

export async function stageModContent({ modPath }) {
  const stagePath = await mkdtemp(join(tmpdir(), 'steam-release-'));
  const ignorePath = join(modPath, '.steamignore');
  const args = ['-av'];

  try {
    const content = await readFile(ignorePath, 'utf8');
    args.push('--exclude=.steamignore', ...buildFilterArgs(content));
  } catch {
  }

  args.push(`${modPath}/`, stagePath);
  await execFileAsync('rsync', args);

  return stagePath;
}
