import { resolve } from 'node:path';
import { verifySteamPublishConfig } from './lib/config.mjs';
import { buildSteamDescription } from './lib/description.mjs';
import { compileReadme, writeCompiledReadme } from './lib/readme.mjs';
import { stageModContent } from './lib/stage-content.mjs';
import { uploadWorkshopItem } from './lib/steamcmd.mjs';

function isDryRun(context) {
  return Boolean(context?.options?.dryRun);
}

function resolveModMetadata(mod, target) {
  const override = mod.metadata?.[target] ?? {};
  return {
    title: override.title ?? mod.title,
    previewfile: override.previewfile ?? mod.previewfile,
    visibility: override.visibility ?? mod.visibility,
    tags: override.tags ?? mod.tags,
  };
}

export async function verifyConditions(pluginConfig, context) {
  await verifySteamPublishConfig({
    env: context.env,
    branchName: context.branch.name,
    branchTargets: pluginConfig.branchTargets,
    mods: pluginConfig.mods,
    appId: pluginConfig.appId,
  });
}

export async function publish(pluginConfig, context) {
  const state = await verifySteamPublishConfig({
    env: context.env,
    branchName: context.branch.name,
    branchTargets: pluginConfig.branchTargets,
    mods: pluginConfig.mods,
    appId: pluginConfig.appId,
  });

  if (!state.shouldPublish) {
    return undefined;
  }

  const cwd = context.cwd ?? process.cwd();
  const dryRun = isDryRun(context);
  const buildDescription = context.buildSteamDescription ?? buildSteamDescription;
  const stageContent = context.stageModContent ?? stageModContent;
  const uploadItem = context.uploadWorkshopItem ?? uploadWorkshopItem;
  const compile = context.compileReadme ?? compileReadme;
  const writeCompiled = context.writeCompiledReadme ?? writeCompiledReadme;
  const assetBaseUrl = pluginConfig.assetBaseUrlTemplate
    ? pluginConfig.assetBaseUrlTemplate.replace('{branch}', context.branch.name)
    : '';

  for (const mod of state.mods) {
    const modPath = resolve(cwd, mod.path);

    const compileArgs = {
      modPath,
      header: pluginConfig.descriptionHeader ?? '',
      footer: pluginConfig.descriptionFooter ?? '',
      assetDirNameTransform: pluginConfig.assetDirNameTransform,
    };

    let markdown;
    if (pluginConfig.outputReadme) {
      markdown = await writeCompiled(compileArgs);
    } else {
      markdown = await compile(compileArgs);
    }

    const description = await buildDescription({
      modPath,
      markdown,
      assetBaseUrl,
    });

    const metadata = resolveModMetadata(mod, state.target);
    const publishedFileId = mod.workshopIds[state.target];
    const changenote = context.nextRelease.notes || context.nextRelease.version;

    if (dryRun) {
      context.logger.log(
        `[dry-run] would publish ${mod.name} to ${state.target} workshop item ${publishedFileId} ` +
          `(changenote: ${context.nextRelease.version}, description: ${description.length} chars` +
          (metadata.title ? `, title: "${metadata.title}"` : '') +
          (metadata.visibility !== undefined ? `, visibility: ${metadata.visibility}` : '') +
          (metadata.tags?.length ? `, tags: [${metadata.tags.join(', ')}]` : '') +
          ')',
      );
      continue;
    }

    const stagePath = await stageContent({ modPath });

    await uploadItem({
      steamCmdPath: context.env.STEAMCMD_PATH ?? '~/steamcmd/steamcmd.sh',
      steamUsername: context.env.STEAM_USERNAME,
      steamConfigPath: state.steamConfigPath,
      appId: pluginConfig.appId,
      stagePath,
      publishedFileId,
      changenote,
      description,
      title: metadata.title,
      previewfile: metadata.previewfile,
      visibility: metadata.visibility,
      tags: metadata.tags,
      timeoutMs: pluginConfig.uploadTimeoutMs,
      verbose: pluginConfig.verbose,
      logger: context.logger,
    });

    context.logger.log(`Published ${mod.name} to ${state.target} workshop item ${publishedFileId}`);
  }

  return undefined;
}

export default { verifyConditions, publish };
