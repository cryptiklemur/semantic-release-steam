# semantic-release-steam

A [semantic-release](https://github.com/semantic-release/semantic-release) plugin that publishes a built Steam Workshop item via [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD).

Originally extracted from the [RimworldCosmere](https://github.com/RimworldCosmere/RimworldCosmere) project's release pipeline. Generic enough to publish any Steam Workshop item for any Steam app, not just RimWorld.

## What it does

On `verifyConditions`:
- Validates that the current branch maps to a configured workshop target (e.g. `main` -> `stable`, `beta` -> `beta`)
- Checks that `STEAM_USERNAME`, a Steam `config.vdf` source (`STEAM_CONFIG_VDF` path or `STEAM_CONFIG_VDF_B64` contents), and `appId` are present
- Throws clearly if a mod has no `workshopIds`, if a target key looks misspelled (with a "did you mean" suggestion), or if no mod is publishable for the resolved target

On `publish`:
- Compiles a Steam Workshop description from each mod's `README.template.md` (markdown -> BBCode via [`@steamdown/core`](https://www.npmjs.com/package/@steamdown/core))
- Stages mod content into a temp dir, respecting `.steamignore`
- Generates a `workshop.vdf` with `appid`, `publishedfileid`, `contentfolder`, `description`, `changenote`, plus optional `title`, `previewfile`, `visibility`, and `tags`
- Invokes `steamcmd +login $STEAM_USERNAME +workshop_build_item ... +quit`
- Honors `semantic-release --dry-run`: logs the intended action without invoking SteamCMD

The plugin assumes you have already created the workshop item once manually via SteamCMD. It updates existing workshop items by their `publishedfileid` - it does NOT create them. (See "First publish" below.)

## Install

```bash
npm install -D semantic-release-steam
```

You'll also need:
- [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD) on `PATH` (or set `STEAMCMD_PATH`). On GitHub Actions, [`buildalon/setup-steamcmd@v1`](https://github.com/marketplace/actions/setup-steamcmd) handles this.
- `rsync` (preinstalled on `ubuntu-latest` runners and macOS).
- A pre-authenticated `config.vdf` from SteamCMD (login once interactively, then base64-encode the resulting file).

> [!NOTE]
> As of v2, the markdown-to-BBCode conversion is bundled as a library dependency. You no longer need to `npm install -g @steamdown/cli`.

## Configuration

In `release.config.mjs`:

```js
export default {
  branches: ['main', { name: 'beta', prerelease: true }],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      'semantic-release-steam',
      {
        appId: '294100',
        branchTargets: { main: 'stable', beta: 'beta' },
        descriptionHeader: '## My Mod\n\n',
        descriptionFooter: '\n\n---\n\nReport issues on GitHub.',
        assetBaseUrlTemplate: 'https://raw.githubusercontent.com/me/my-mod/{branch}',
        uploadTimeoutMs: 600000,
        mods: [
          {
            name: 'MyMod',
            path: 'MyMod',
            workshopIds: { stable: '1234567890', beta: '1234567891' },
            title: 'My Mod',
            tags: ['QoL', 'Utility'],
            visibility: 0,
            metadata: {
              beta: { title: '[BETA] My Mod' },
            },
          },
        ],
      },
    ],
  ],
};
```

### Plugin options

| Option | Required | Description |
|---|---|---|
| `appId` | Yes | Steam app ID (e.g. `294100` for RimWorld). |
| `branchTargets` | Yes | Map of git branch name to workshop target key. Branches not in the map are skipped (silently). |
| `mods` | Yes | Array of [mod config](#mod-config). |
| `descriptionHeader` | No | String prepended to each mod's compiled README before BBCode conversion. |
| `descriptionFooter` | No | String appended to each mod's compiled README. |
| `assetBaseUrlTemplate` | No | URL template with `{branch}` placeholder. Asset paths matching `../.github/assets/` in the README are rewritten to absolute URLs against this base. |
| `assetDirNameTransform` | No | Either an array of subdirectory names under `.github/assets/` (literals or glob patterns), or a function `(modPath) => string[]` returning the ordered list. Default: `[basename(modPath).toLowerCase(), 'fallback']`. |
| `outputReadme` | No | If `true`, also write the compiled markdown to `<modPath>/README.md` (v1 behavior). Default `false` — the compiled README stays in memory. |
| `uploadTimeoutMs` | No | Max time in ms to wait for SteamCMD. Default `600000` (10 min). |
| `verbose` | No | Log SteamCMD stdout/stderr at info level. Default `false` (debug level). |

### Mod config

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Human-readable name, used in logs. |
| `path` | Yes | Mod content directory, relative to the semantic-release cwd. |
| `workshopIds` | Yes | Map of branch-target key (from `branchTargets`) to Steam Workshop `publishedfileid`. |
| `title` | No | Workshop item title. Only written into the VDF if set. |
| `previewfile` | No | Path to a preview image (jpg/png). Only written if set. |
| `visibility` | No | `0` = public, `1` = friends-only, `2` = private, `3` = unlisted. |
| `tags` | No | Workshop tag array. |
| `metadata` | No | Per-target overrides. Keys must match values from `branchTargets`. Per-target fields win over mod-level defaults. |

Workshop fields (`title`, `previewfile`, `visibility`, `tags`) are only emitted into the VDF when set, so manual edits made in the Steam workshop UI are preserved across publishes for fields you don't manage in config.

### Required environment variables

| Var | Purpose |
|---|---|
| `STEAM_USERNAME` | Steam account username with workshop publish permission. |
| `STEAM_CONFIG_VDF` | Path to a pre-authenticated `config.vdf`. |
| `STEAM_CONFIG_VDF_B64` | Alternative to `STEAM_CONFIG_VDF`: base64-encoded contents of `config.vdf`. The plugin decodes it to a temp file. |
| `STEAMCMD_PATH` | Optional. Path to `steamcmd.sh` / `steamcmd.exe`. Defaults to `~/steamcmd/steamcmd.sh`. |

At least one of `STEAM_CONFIG_VDF` or `STEAM_CONFIG_VDF_B64` must be set. If both are set, the path wins.

> [!IMPORTANT]
> SteamCMD reads its auth from `$STEAM_DIR/config/config.vdf` (the install dir's config directory). Setting `STEAM_CONFIG_VDF` only tells the plugin where to find the file; you still need to put a copy at the path SteamCMD expects. See the GitHub Actions example below for the standard pattern.

## GitHub Actions example

A copy-pasteable workflow that runs semantic-release with the Steam plugin:

```yaml
name: release

on:
  push:
    branches: [main, beta]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install
        run: npm ci

      - name: Set up SteamCMD
        uses: buildalon/setup-steamcmd@v1

      - name: Restore Steam config
        env:
          STEAM_CONFIG_VDF_B64: ${{ secrets.STEAM_CONFIG_VDF_B64 }}
        run: |
          mkdir -p "$STEAM_DIR/config"
          printf '%s' "$STEAM_CONFIG_VDF_B64" | base64 -d > "$STEAM_DIR/config/config.vdf"
          echo "STEAM_CONFIG_VDF=$STEAM_DIR/config/config.vdf" >> "$GITHUB_ENV"

      - name: Steam login preflight
        env:
          STEAM_USERNAME: ${{ secrets.STEAM_USERNAME }}
        run: |
          "$STEAM_CMD/steamcmd.sh" +@ShutdownOnFailedCommand 1 +@NoPromptForPassword 1 +login "$STEAM_USERNAME" +quit

      - name: Run semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          STEAM_USERNAME: ${{ secrets.STEAM_USERNAME }}
          STEAM_CONFIG_VDF: ${{ env.STEAM_CONFIG_VDF }}
          STEAMCMD_PATH: ${{ env.STEAM_CMD }}/steamcmd.sh
        run: npx semantic-release
```

The two secrets you need:
- `STEAM_USERNAME` — your Steam account username
- `STEAM_CONFIG_VDF_B64` — `base64 -w 0 ~/Steam/config/config.vdf` from a machine where you've successfully logged in with `steamcmd +login <user> +quit`

## First publish

semantic-release-steam UPDATES existing workshop items - it does not create them. Before the plugin can run, each mod needs a `publishedfileid` per branch target.

For each branch target (e.g. `stable`, `beta`):

1. Build your mod content locally.
2. Stage it into a temp dir, generate a `workshopitem` VDF (without `publishedfileid`), and run `steamcmd +login $STEAM_USERNAME +workshop_build_item path/to/workshop.vdf +quit`.
3. Note the `publishedfileid` printed by SteamCMD.
4. Add the ID to your release config under `mods[*].workshopIds.<target>`.

For RimWorld specifically, the easier path is to publish the mod once via the in-game workshop publisher, then copy the workshop ID into your config.

After that, every push to `main` / `beta` will trigger an update via this plugin.

## Example `.steamignore`

Place at the root of each mod's `path` to exclude files from the upload. Patterns use rsync exclude syntax, plus gitignore-style `!` negation to re-include something a broader pattern would exclude. Later patterns win over earlier ones (gitignore semantics), so put negations after the patterns they override.

```
# Keep .run/ even though dotfiles below are excluded
.*
!.run/

# Source control
.git
.gitignore
.gitattributes

# Docs and templates (the workshop description comes from README.template.md, not these)
README.md
README.template.md
*.md

# Build inputs (the staged dir should contain only runtime artifacts)
Source/
src/
*.csproj
*.sln

# CI and local dev clutter
.github/
.vscode/
.idea/
node_modules/

# OS junk
.DS_Store
Thumbs.db
```

## How the README gets compiled into a workshop description

Each mod is expected to have a `README.template.md`. The plugin:

1. Concatenates `descriptionHeader + zeroWidthSeparator + template + zeroWidthSeparator + descriptionFooter`.
2. Runs an asset fallback substitution: any `../.github/assets/fallback/<name>` reference is replaced with `../.github/assets/<modspecificdir>/<name>` if a matching file exists. `<modspecificdir>` is resolved from `assetDirNameTransform`.
3. Rewrites `../.github/assets/` paths to absolute URLs using `assetBaseUrlTemplate` (so Steam's BBCode renderer can fetch them).
4. Pipes the result through `@steamdown/core` to convert Markdown to Steam BBCode.
5. Writes the BBCode into the workshop item description field.

If a mod has no `README.template.md` (and `outputReadme` is off, leaving no `README.md` to fall back on), the description defaults to `"No description available."`.

By default the compiled markdown stays in memory and never touches your repo. Set `outputReadme: true` if you want the compiled `README.md` written to `<modPath>/README.md` (e.g. so `@semantic-release/git` can commit it).

## Upgrading from 1.x

Breaking changes in 2.0:

- **`@steamdown/cli` is no longer required.** The plugin now uses `@steamdown/core` directly. Remove `npm install -g @steamdown/cli` from your CI.
- **`README.md` is no longer written into each mod dir by default.** If you relied on this (e.g. committing it via `@semantic-release/git`), set `outputReadme: true`.
- **Misconfigurations now throw instead of silently skipping.** Specifically: a mod with empty `workshopIds`, a mod missing the target key when no other mod has it either, or a misspelled target key (caught via did-you-mean).
- **Default upload timeout raised from 2 to 10 minutes.** Set `uploadTimeoutMs` to override.

New in 2.0:

- `STEAM_CONFIG_VDF_B64` env var accepted alongside `STEAM_CONFIG_VDF`.
- Optional workshop metadata: `title`, `previewfile`, `visibility`, `tags`. Per-mod defaults with per-target overrides via `mod.metadata[target]`.
- `assetDirNameTransform` accepts an array (literal or glob) in addition to a function.
- `semantic-release --dry-run` is honored.
- `verbose` option to surface SteamCMD output at info level.
- TypeScript declaration file shipped (`index.d.ts`) and JSON schema (`schema/plugin-config.json`).

## License

MIT - see [LICENSE](./LICENSE).
