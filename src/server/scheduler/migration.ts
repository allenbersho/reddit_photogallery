import { redis } from '@devvit/web/server';
import {
  loadTaxonomyRules,
  evaluateTagPipeline,
} from '../core/taxonomySettings.js';
import type { SettingsClientContract } from '../core/topicSettings.js';
import {
  clearLegacyTopicIndexes,
  getGalleryItem,
  getJobState,
  setJobState,
  updateGalleryItemTags,
  REDIS_KEYS,
  type RedisClientContract,
} from '../data/galleryStore.js';

export type MigrationProgress = {
  status: 'not_started' | 'in_progress' | 'completed';
  schemaVersion: string;
  processedCount: number;
  migratedCount: number;
  skippedCount: number;
  totalItems: number;
  cursor: number;
  percentComplete: number;
  lastRunAt?: number;
  completedAt?: number;
};

export type MigrationBatchResult = {
  status: 'in_progress' | 'completed';
  batchProcessed: number;
  batchMigrated: number;
  batchSkipped: number;
  totalProcessed: number;
  totalItems: number;
  nextCursor?: string;
  isComplete: boolean;
};

export const runMigrationJob = async (
  redisClient: RedisClientContract = redis,
  settingsClient?: SettingsClientContract,
  batchSize = 25
): Promise<MigrationBatchResult> => {
  const totalItems = await redisClient.zCard(REDIS_KEYS.idxTime());

  if (totalItems === 0) {
    await redisClient.set(REDIS_KEYS.schemaVersion(), 'v2.0');
    await setJobState('migration_status', 'completed', redisClient);
    return {
      status: 'completed',
      batchProcessed: 0,
      batchMigrated: 0,
      batchSkipped: 0,
      totalProcessed: 0,
      totalItems: 0,
      isComplete: true,
    };
  }

  const cursorStr = await getJobState('migration_cursor', redisClient);
  const offset = cursorStr ? Number.parseInt(cursorStr, 10) : 0;

  if (offset >= totalItems) {
    // Migration is complete, execute verification & legacy index purge
    await clearLegacyTopicIndexes(redisClient);
    await redisClient.set(REDIS_KEYS.schemaVersion(), 'v2.0');
    await setJobState('migration_status', 'completed', redisClient);
    await setJobState('migration_completed_at', Date.now().toString(), redisClient);
    console.log(
      `[Migration v2] Completed migration of ${totalItems} items. Legacy topic indexes removed.`
    );
    return {
      status: 'completed',
      batchProcessed: 0,
      batchMigrated: 0,
      batchSkipped: 0,
      totalProcessed: totalItems,
      totalItems,
      isComplete: true,
    };
  }

  const range = await redisClient.zRange(
    REDIS_KEYS.idxTime(),
    offset,
    offset + batchSize - 1,
    { by: 'rank', reverse: false }
  );

  const rules = await loadTaxonomyRules(settingsClient);

  let batchMigrated = 0;
  let batchSkipped = 0;

  for (const entry of range) {
    const item = await getGalleryItem(entry.member, redisClient);
    if (!item) {
      batchSkipped++;
      continue;
    }

    // Safety rule: Keep already confirmed tags safe!
    // Never silently delete user or moderator tags.
    const hasUserOrModTags =
      item.disciplinesSource === 'poster-tagged' ||
      item.disciplinesSource === 'mod-verified' ||
      item.impactsSource === 'poster-tagged' ||
      item.impactsSource === 'mod-verified';

    if (hasUserOrModTags) {
      // Re-index to ensure sorted sets contain this item
      await updateGalleryItemTags(
        item.id,
        {
          disciplines: item.disciplines,
          disciplinesSource: item.disciplinesSource,
          impacts: item.impacts,
          impactsSource: item.impactsSource,
        },
        redisClient
      );
      batchSkipped++;
      continue;
    }

    // Re-evaluate unconfirmed or untagged items with the new Chimera tagging pipeline
    // Old topics are not guessed (do NOT map Science -> Biology). Unmatched items remain untagged.
    const pipelineResult = evaluateTagPipeline({
      title: item.title,
      rules,
    });

    await updateGalleryItemTags(
      item.id,
      {
        disciplines: pipelineResult.disciplines,
        disciplinesSource: pipelineResult.disciplinesSource,
        impacts: pipelineResult.impacts,
        impactsSource: pipelineResult.impactsSource,
      },
      redisClient
    );
    batchMigrated++;
  }

  const nextOffset = offset + range.length;
  const isComplete = nextOffset >= totalItems;

  await setJobState('migration_cursor', nextOffset.toString(), redisClient);
  await setJobState(
    'migration_status',
    isComplete ? 'completed' : 'in_progress',
    redisClient
  );
  await setJobState('migration_last_run', Date.now().toString(), redisClient);

  const prevProcessedStr = await getJobState('migration_processed', redisClient);
  const totalProcessed =
    (prevProcessedStr ? Number.parseInt(prevProcessedStr, 10) : 0) +
    range.length;
  await setJobState('migration_processed', totalProcessed.toString(), redisClient);

  const prevMigratedStr = await getJobState('migration_migrated', redisClient);
  const totalMigrated =
    (prevMigratedStr ? Number.parseInt(prevMigratedStr, 10) : 0) + batchMigrated;
  await setJobState('migration_migrated', totalMigrated.toString(), redisClient);

  const prevSkippedStr = await getJobState('migration_skipped', redisClient);
  const totalSkipped =
    (prevSkippedStr ? Number.parseInt(prevSkippedStr, 10) : 0) + batchSkipped;
  await setJobState('migration_skipped', totalSkipped.toString(), redisClient);

  const percent = Math.min(
    100,
    Math.round((totalProcessed / Math.max(1, totalItems)) * 100)
  );
  console.log(
    `[Migration v2] Processed ${totalProcessed}/${totalItems} items (${percent}% complete, batch migrated: ${batchMigrated}, preserved: ${batchSkipped})`
  );

  if (isComplete) {
    await clearLegacyTopicIndexes(redisClient);
    await redisClient.set(REDIS_KEYS.schemaVersion(), 'v2.0');
    await setJobState('migration_status', 'completed', redisClient);
    await setJobState(
      'migration_completed_at',
      Date.now().toString(),
      redisClient
    );
    console.log(
      `[Migration v2] Migration completed successfully for ${totalItems} items. Obsolete topic indexes cleaned up.`
    );
  }

  return {
    status: isComplete ? 'completed' : 'in_progress',
    batchProcessed: range.length,
    batchMigrated,
    batchSkipped,
    totalProcessed,
    totalItems,
    nextCursor: isComplete ? undefined : nextOffset.toString(),
    isComplete,
  };
};

export const resetMigration = async (
  redisClient: RedisClientContract = redis
): Promise<void> => {
  await setJobState('migration_cursor', '0', redisClient);
  await setJobState('migration_status', 'in_progress', redisClient);
  await setJobState('migration_processed', '0', redisClient);
  await setJobState('migration_migrated', '0', redisClient);
  await setJobState('migration_skipped', '0', redisClient);
  await setJobState('migration_last_run', Date.now().toString(), redisClient);
};

export const getMigrationStatus = async (
  redisClient: RedisClientContract = redis
): Promise<MigrationProgress> => {
  const [
    statusStr,
    cursorStr,
    processedStr,
    migratedStr,
    skippedStr,
    lastRunStr,
    completedStr,
    schemaVersion,
    totalItems,
  ] = await Promise.all([
    getJobState('migration_status', redisClient),
    getJobState('migration_cursor', redisClient),
    getJobState('migration_processed', redisClient),
    getJobState('migration_migrated', redisClient),
    getJobState('migration_skipped', redisClient),
    getJobState('migration_last_run', redisClient),
    getJobState('migration_completed_at', redisClient),
    redisClient.get(REDIS_KEYS.schemaVersion()),
    redisClient.zCard(REDIS_KEYS.idxTime()),
  ]);

  const cursor = cursorStr ? Number.parseInt(cursorStr, 10) : 0;
  const processedCount = processedStr ? Number.parseInt(processedStr, 10) : 0;
  const migratedCount = migratedStr ? Number.parseInt(migratedStr, 10) : 0;
  const skippedCount = skippedStr ? Number.parseInt(skippedStr, 10) : 0;
  const lastRunAt = lastRunStr ? Number.parseInt(lastRunStr, 10) : undefined;
  const completedAt = completedStr ? Number.parseInt(completedStr, 10) : undefined;

  let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
  if (statusStr === 'completed') {
    status = 'completed';
  } else if (statusStr === 'in_progress' || cursor > 0) {
    status = 'in_progress';
  }

  const percentComplete =
    totalItems === 0
      ? 100
      : Math.min(100, Math.round((processedCount / totalItems) * 100));

  return {
    status,
    schemaVersion: schemaVersion ?? 'v1.0',
    processedCount,
    migratedCount,
    skippedCount,
    totalItems,
    cursor,
    percentComplete,
    lastRunAt,
    completedAt,
  };
};
