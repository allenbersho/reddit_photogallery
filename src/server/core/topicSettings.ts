import { settings } from '@devvit/web/server';
import type { TopicMappingRules } from '../../shared/types.js';

export type SettingsClientContract = {
  get(name: string): Promise<unknown>;
};

export const DEFAULT_TOPIC_RULES: TopicMappingRules = {
  scienceKeywords: ['science', 'physics', 'chem', 'bio', 'space', 'astronomy'],
  engineeringKeywords: [
    'engineer',
    'tech',
    'technology',
    'robot',
    'mechanic',
    'code',
  ],
  artKeywords: ['art', 'photo', 'photography', 'design', 'paint', 'draw'],
};

export const parseKeywords = (csv?: string | null): string[] => {
  if (!csv) {
    return [];
  }
  return csv
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
};

export const loadTopicRules = async (
  client?: SettingsClientContract
): Promise<TopicMappingRules> => {
  const settingsClient = client ?? settings;
  if (!settingsClient) {
    return DEFAULT_TOPIC_RULES;
  }

  try {
    const [scienceVal, engineeringVal, artVal] = await Promise.all([
      settingsClient.get('scienceFlairs'),
      settingsClient.get('engineeringFlairs'),
      settingsClient.get('artFlairs'),
    ]);

    const parsedScience = parseKeywords(
      typeof scienceVal === 'string' ? scienceVal : null
    );
    const parsedEngineering = parseKeywords(
      typeof engineeringVal === 'string' ? engineeringVal : null
    );
    const parsedArt = parseKeywords(typeof artVal === 'string' ? artVal : null);

    return {
      scienceKeywords:
        parsedScience.length > 0
          ? parsedScience
          : DEFAULT_TOPIC_RULES.scienceKeywords,
      engineeringKeywords:
        parsedEngineering.length > 0
          ? parsedEngineering
          : DEFAULT_TOPIC_RULES.engineeringKeywords,
      artKeywords:
        parsedArt.length > 0 ? parsedArt : DEFAULT_TOPIC_RULES.artKeywords,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Devvit config is not available')) {
      console.warn(
        'Failed to load topic flair settings, using defaults:',
        message
      );
    }
    return DEFAULT_TOPIC_RULES;
  }
};
