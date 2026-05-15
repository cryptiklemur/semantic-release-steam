# semantic-release-steam

A [semantic-release](https://github.com/semantic-release/semantic-release) plugin that publishes a built Steam Workshop item via [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD).

Originally extracted from the [RimworldCosmere](https://github.com/RimworldCosmere/RimworldCosmere) project's release pipeline. Generic enough to publish any Steam Workshop item for any Steam app, not just RimWorld.

## What it does

On `verifyConditions`:
- Validates that the current branch maps to a configured workshop target (e.g. `main` -> `stable`, `beta` -> `beta`)
- Checks that `STEAM_USERNAME`, `STEAM_CONFIG_VDF`, and `appId` are present
- Verifies that at least one configured mod has a workshop ID for the resolved target

On `publish`:
- Compiles a Steam Workshop description from each mod's `README.md` (markdown -> BBCode via [steamdown](https://github.com/steamdown/steamdown))
- Stages mod content into a temp dir, respecting `.steamignore`
- Generates a `workshop.vdf` with `appid`, `publishedfileid`, `contentfolder`, `description`, and `changenote`
- Invokes `steamcmd +login $STEAM_USERNAME +workshop_build_item ... +quit`

The plugin assumes you have already created the workshop item once manually via SteamCMD. It updates existing workshop items by their `publishedfileid` - it does NOT create them. (See "First publish" below.)

## Install

```bash
npm install -D semantic-release-steam
```

You'll also need:
- [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD) on `PATH` (or set `STEAMCMD_PATH`)
- [steamdown](https://www.npmjs.com/package/@steamdown/cli) installed globally for the markdown -> BBCode conversion: `npm install -g @steamdown/cli`
- A pre-authenticated `config.vdf` from SteamCMD (login once interactively, then base64-encode the resulting file into `STEAM_CONFIG_VDF_B64` for CI)

## Configuration

In `.releaserc.json` / `release.config.mjs`:

```js
export default {
  branches: ["main", { name: "beta", prerelease: true }],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "semantic-release-steam",
      {
        appId: "294100",
        branchTargets: { main: "stable", beta: "beta" },
        descriptionHeader: "## My Mod\n\n",
        descriptionFooter: "\n\n---\n\nReport issues on GitHub.",
        assetBaseUrlTemplate: "https://raw.githubusercontent.com/me/my-mod/{branch}",
        mods: [
          {
            name: "MyMod",
            path: "MyMod",
            workshopIds: { stable: "1234567890", beta: "1234567891" }
          }
        ]
      }
    ]
  ]
};
```

### Plugin options

| Option | Required | Description |
|---|---|---|
| `appId` | Yes | Steam app ID (e.g. `294100` for RimWorld). |
| `branchTargets` | Yes | Map of git branch name to workshop visibility tag. Branches not in the map are skipped. |
| `mods` | Yes | Array of `{ name, path, workshopIds }`. `workshopIds` is keyed by the values in `branchTargets`. |
| `descriptionHeader` | No | String prepended to each mod's compiled README before BBCode conversion. |
| `descriptionFooter` | No | String appended to each mod's compiled README. |
| `assetBaseUrlTemplate` | No | A URL template with `{branch}` placeholder. Asset paths matching `../.github/assets/` in the README are rewritten to absolute URLs against this base before BBCode conversion (so workshop pages don't 404 on relative asset references). |
| `assetDirNameTransform` | No | Function `(modPath) => string[]` returning an ordered list of asset subdirectory names to try inside `<repoRoot>/.github/assets/<dir>/` for fallback substitution. Default: `[basename(modPath).toLowerCase(), 'fallback']`. |

### Required environment variables

| Var | Purpose |
|---|---|
| `STEAM_USERNAME` | Steam account username with workshop publish permission for the configured `appId`. |
| `STEAM_CONFIG_VDF` | Path to a pre-authenticated `config.vdf` (the file SteamCMD writes after a successful interactive login). For CI, decode `STEAM_CONFIG_VDF_B64` into a temp file and pass its path. |
| `STEAMCMD_PATH` | Optional. Path to `steamcmd.sh` / `steamcmd.exe`. Defaults to `~/steamcmd/steamcmd.sh`. |

## First publish

semantic-release-steam UPDATES existing workshop items - it does not create them. Before the plugin can run, each mod needs a `publishedfileid` per branch target.

For each branch target (e.g. `stable`, `beta`):

1. Build your mod content locally.
2. Stage it into a temp dir, generate a `workshopitem` VDF (without `publishedfileid`), and run `steamcmd +login $STEAM_USERNAME +workshop_build_item path/to/workshop.vdf +quit`.
3. Note the `publishedfileid` printed by SteamCMD.
4. Add the ID to your release config under `mods[*].workshopIds.<target>`.

After that, every push to `main` / `beta` will trigger an update via this plugin.

## How the README gets compiled into a workshop description

Each mod is expected to have a `README.template.md`. The plugin:

1. Concatenates `descriptionHeader + zeroWidthSeparator + template + zeroWidthSeparator + descriptionFooter` into `README.md` at the mod root.
2. Runs an asset fallback substitution: any `../.github/assets/fallback/<name>` reference is replaced with `../.github/assets/<modspecificdir>/<name>` if a matching file exists, where `<modspecificdir>` comes from `assetDirNameTransform(modPath)`.
3. Rewrites `../.github/assets/` paths to absolute URLs using `assetBaseUrlTemplate` (so Steam's BBCode renderer can fetch them).
4. Pipes the result through `steamdown` to convert Markdown to Steam BBCode.
5. Writes the BBCode into the workshop item description field.

If a mod has no `README.md`, the description defaults to `"No description available."`.

## License

MIT - see [LICENSE](./LICENSE).
