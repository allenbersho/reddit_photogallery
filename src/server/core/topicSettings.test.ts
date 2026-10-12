import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TOPIC_RULES,
  loadTopicRules,
  parseKeywords,
  type SettingsClientContract,
} from './topicSettings.js';

describe('topicSettings', () => {
  describe('parseKeywords', () => {
    it('parses comma-separated keywords into trimmed lowercase strings', () => {
      const result = parseKeywords(' Science , Astronomy, BIOLOGY ');
      expect(result).toEqual(['science', 'astronomy', 'biology']);
    });

    it('filters out empty entries and extra commas', () => {
      const result = parseKeywords('tech,, ,,robotics, ');
      expect(result).toEqual(['tech', 'robotics']);
    });

    it('returns empty array for empty or null input', () => {
      expect(parseKeywords('')).toEqual([]);
      expect(parseKeywords(null)).toEqual([]);
      expect(parseKeywords(undefined)).toEqual([]);
    });
  });

  describe('loadTopicRules', () => {
    it('loads custom rules from settings client', async () => {
      const mockSettingsClient: SettingsClientContract = {
        get: vi.fn(async (key: string) => {
          if (key === 'scienceFlairs') return 'quantum, lab, genetics';
          if (key === 'engineeringFlairs') return 'circuits, arduino';
          if (key === 'artFlairs') return 'oil painting, sculpture';
          return undefined;
        }),
      };

      const rules = await loadTopicRules(mockSettingsClient);
      expect(rules.scienceKeywords).toEqual(['quantum', 'lab', 'genetics']);
      expect(rules.engineeringKeywords).toEqual(['circuits', 'arduino']);
      expect(rules.artKeywords).toEqual(['oil painting', 'sculpture']);
    });

    it('falls back to defaults if settings return empty or undefined', async () => {
      const mockSettingsClient: SettingsClientContract = {
        get: vi.fn(async () => undefined),
      };

      const rules = await loadTopicRules(mockSettingsClient);
      expect(rules).toEqual(DEFAULT_TOPIC_RULES);
    });

    it('handles client errors gracefully and returns default rules', async () => {
      const mockSettingsClient: SettingsClientContract = {
        get: vi.fn(async () => {
          throw new Error('Redis connection failed');
        }),
      };

      const rules = await loadTopicRules(mockSettingsClient);
      expect(rules).toEqual(DEFAULT_TOPIC_RULES);
    });
  });
});
