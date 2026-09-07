# AGENTS.md

## AI usage

We don't vibecode here. Use AI if it helps, but read what it wrote and understand it before
it lands. You own what ships, whether or not a model typed it.

We can't stop anyone from working the way they want to. We can set guardrails so what lands
is as good as it can be. The rest of this file is those guardrails. Run the tests, match the
code around yours, stay inside the request, and report failures instead of guessing past them.

If AI helped with a commit in any way, add an `AI-assisted: <tool name>` trailer to the
commit message.

Agents: if the user commits by hand, remind them to add the trailer.

## Project overview

A semantic-release plugin that publishes a built mod directory to an existing Steam Workshop
item. It uploads through SteamCMD and converts each mod's `README.template.md` into Steam
BBCode with `@steamdown/core`. The plugin is published to npm, so its options are a public
API: `index.d.ts` and `schema/plugin-config.json` both describe them and both have to stay in
step with `lib/config.mjs`. See `README.md` for the consumer setup.

## Project structure

- `index.mjs` - the plugin entry point and its semantic-release lifecycle hooks
- `index.d.ts` - hand-written types for the plugin options
- `lib/` - `config.mjs`, `steamcmd.mjs`, `vdf.mjs`, `readme.mjs`, `description.mjs`,
  `stage-content.mjs`
- `schema/plugin-config.json` - JSON schema for the plugin options
- `tests/` - `node:test` suites, one per lib module, plus fixtures

## Setup & build

```bash
npm install    # Node 20+. There is no build step; this is plain ESM
```

## Testing

```bash
npm test                            # node --test tests/*.test.mjs
node --test tests/vdf.test.mjs      # one file
npm run lint && npm run typecheck   # eslint + tsc --noEmit
npm run test:check-config           # verifyConditions against a realistic config
```

- Run the full suite before committing. All tests must pass.
- While iterating, run the single test closest to your change.
- Never delete, weaken, or rewrite a test to make a change pass.
- Do not claim that an interrupted or timed-out run passed.

## Code style

- Linter: eslint, configured in `eslint.config.mjs`. There is no formatter, so follow the
  patterns already in neighboring files.
- Do not add comments that restate the code.
- Do not reformat code you are not otherwise changing.

## Git workflow

- Work on `main`. This repo has no feature branches and no pull requests.
- Commit format: Conventional Commits, one line, lowercase.
- Never commit, push, or open a PR unless asked.
- All CI checks must pass. semantic-release publishes to npm with provenance on every push
  to `main`.

## Boundaries

- Do not modify unrelated files or widen scope beyond the request.
- Do not add dependencies without asking.
- Never commit secrets, API keys, or .env files. SteamCMD credentials come from the release
  runner's environment.
- A new or renamed plugin option means three edits: `lib/config.mjs`, `index.d.ts` and
  `schema/plugin-config.json`.
- If a command fails, report the failure. Do not guess or present assumptions as confirmed
  results.
