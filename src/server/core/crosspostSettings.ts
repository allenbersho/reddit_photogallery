import { settings } from '@devvit/web/server';
import type { SettingsClientContract } from './topicSettings.js';

export type CrosspostSettings = {
  enableCrossposts: boolean;
  allowlist: string[];
  blocklist: string[];
};

export const DEFAULT_CROSSPOST_SETTINGS: CrosspostSettings = {
  enableCrossposts: true,
  allowlist: [],
  blocklist: [],
};

const parseSubredditList = (csv?: string | null): string[] => {
  if (!csv) {
    return [];
  }
  return csv
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^r\//, ''))
    .filter((s) => s.length > 0);
};

export const loadCrosspostSettings = async (
  client?: SettingsClientContract
): Promise<CrosspostSettings> => {
  const settingsClient = client ?? settings;
  if (!settingsClient) {
    return DEFAULT_CROSSPOST_SETTINGS;
  }

  try {
    const [enabledVal, allowlistVal, blocklistVal] = await Promise.all([
      settingsClient.get('enableCrossposts'),
      settingsClient.get('crosspostAllowlist'),
      settingsClient.get('crosspostBlocklist'),
    ]);

    const enableCrossposts =
      typeof enabledVal === 'boolean'
        ? enabledVal
        : DEFAULT_CROSSPOST_SETTINGS.enableCrossposts;

    const allowlist = parseSubredditList(
      typeof allowlistVal === 'string' ? allowlistVal : null
    );
    const blocklist = parseSubredditList(
      typeof blocklistVal === 'string' ? blocklistVal : null
    );

    return {
      enableCrossposts,
      allowlist,
      blocklist,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Devvit config is not available')) {
      console.warn('Failed to load crosspost settings, using defaults:', message);
    }
    return DEFAULT_CROSSPOST_SETTINGS;
  }
};

export const isSourceSubredditAllowed = (
  sourceSubreddit: string,
  settings: CrosspostSettings
): boolean => {
  if (!settings.enableCrossposts) {
    return false;
  }
  const normalized = sourceSubreddit.trim().toLowerCase().replace(/^r\//, '');
  if (settings.blocklist.length > 0 && settings.blocklist.includes(normalized)) {
    return false;
  }
  if (settings.allowlist.length > 0 && !settings.allowlist.includes(normalized)) {
    return false;
  }
  return true;
};
