import { describe, expect, it } from 'vitest';
import {
  suggestDisciplinesFromTitle,
  suggestImpactsFromTitle,
} from './keywordSuggester.js';
import {
  DEFAULT_TAXONOMY_RULES,
  deriveTaxonomyFromFlair,
  evaluateTagPipeline,
  loadTaxonomyRules,
  type TaxonomyMappingRules,
} from './taxonomySettings.js';
import type { SettingsClientContract } from './topicSettings.js';

describe('Taxonomy Keyword Suggester', () => {
  describe('suggestDisciplinesFromTitle', () => {
    it('suggests Electromagnetics for related keywords', () => {
      expect(suggestDisciplinesFromTitle('New RF antenna circuit design')).toContain(
        'Electromagnetics'
      );
      expect(suggestDisciplinesFromTitle('High voltage transformer test')).toContain(
        'Electromagnetics'
      );
    });

    it('suggests Mechanics for related keywords', () => {
      expect(suggestDisciplinesFromTitle('Suspension bridge with turbine engine')).toContain(
        'Mechanics'
      );
      expect(suggestDisciplinesFromTitle('Robotics actuator demonstration')).toContain(
        'Mechanics'
      );
    });

    it('suggests Biology for related keywords', () => {
      expect(suggestDisciplinesFromTitle('Single cell DNA sequencing of marine wildlife')).toContain(
        'Biology'
      );
      expect(suggestDisciplinesFromTitle('Neuron and brain tissue microscopy')).toContain(
        'Biology'
      );
    });

    it('suggests Mathematics for related keywords', () => {
      expect(suggestDisciplinesFromTitle('Fractal geometry and proof of theorem')).toContain(
        'Mathematics'
      );
      expect(suggestDisciplinesFromTitle('Calculus and algorithm design')).toContain(
        'Mathematics'
      );
    });

    it('suggests Arts for related keywords', () => {
      expect(suggestDisciplinesFromTitle('Oil painting and sculpture exhibition')).toContain(
        'Arts'
      );
      expect(suggestDisciplinesFromTitle('Modern photography and graphic design')).toContain(
        'Arts'
      );
    });

    it('suggests Materials for related keywords', () => {
      expect(suggestDisciplinesFromTitle('Novel polymer crystal and alloy synthesis')).toContain(
        'Materials'
      );
      expect(suggestDisciplinesFromTitle('Ceramic metallurgy research')).toContain(
        'Materials'
      );
    });

    it('enforces word-boundary checks and avoids false substring matches', () => {
      // 'art' shouldn't match 'smart', 'cart', 'part', 'start'
      expect(suggestDisciplinesFromTitle('A smart cart ready to start')).toEqual([]);
      // 'cell' shouldn't match 'cellar'
      expect(suggestDisciplinesFromTitle('Wine cellar storage')).toEqual([]);
      // 'rf' shouldn't match 'surf' or 'turf'
      expect(suggestDisciplinesFromTitle('Surfing on turf')).toEqual([]);
      // 'dna' shouldn't match 'kidnapped'
      expect(suggestDisciplinesFromTitle('Kidnapped in the woods')).toEqual([]);
    });

    it('supports multiple discipline suggestions simultaneously', () => {
      const suggestions = suggestDisciplinesFromTitle(
        'Robotics cell with micro-circuit and polymer actuator'
      );
      expect(suggestions).toContain('Mechanics');
      expect(suggestions).toContain('Electromagnetics');
      expect(suggestions).toContain('Biology');
      expect(suggestions).toContain('Materials');
    });

    it('is case-insensitive', () => {
      const suggestions = suggestDisciplinesFromTitle(
        'CIRCUIT DESIGN WITH ROBOTICS MOTORS'
      );
      expect(suggestions).toContain('Electromagnetics');
      expect(suggestions).toContain('Mechanics');
    });

    it('returns empty array when title has no matching keywords', () => {
      expect(suggestDisciplinesFromTitle('A random Tuesday afternoon')).toEqual([]);
    });
  });

  describe('suggestImpactsFromTitle', () => {
    it('suggests Self for personal/wearable keywords', () => {
      expect(suggestImpactsFromTitle('My personal wearable fitness tracker')).toContain(
        'Self'
      );
    });

    it('suggests Home for domestic/indoor keywords', () => {
      expect(suggestImpactsFromTitle('Indoor greenhouse for domestic gardening')).toContain(
        'Home'
      );
    });

    it('suggests Friends for social/team keywords', () => {
      expect(suggestImpactsFromTitle('Our team built this social robotics project')).toContain(
        'Friends'
      );
    });

    it('suggests Government for civic/infrastructure keywords', () => {
      expect(suggestImpactsFromTitle('Public civic infrastructure bridge design')).toContain(
        'Government'
      );
    });

    it('enforces word-boundary checks for impact keywords', () => {
      // 'self' shouldn't match 'selfishness' or 'himself'
      expect(suggestImpactsFromTitle('He spoke for himself')).toEqual([]);
      // 'home' shouldn't match 'homerun'
      expect(suggestImpactsFromTitle('Baseball homerun')).toEqual([]);
    });
  });
});

describe('Taxonomy Settings & Rules', () => {
  describe('deriveTaxonomyFromFlair', () => {
    it('matches single discipline from flair', () => {
      const res = deriveTaxonomyFromFlair('Subreddit Biology Showcase');
      expect(res.disciplines).toEqual(['Biology']);
      expect(res.impacts).toEqual([]);
    });

    it('matches discipline and impact from compound flair', () => {
      const res = deriveTaxonomyFromFlair('Electronics / Civic Infrastructure');
      expect(res.disciplines).toEqual(['Electromagnetics']);
      expect(res.impacts).toEqual(['Government']);
    });

    it('returns empty lists for unknown flair', () => {
      const res = deriveTaxonomyFromFlair('General Discussion');
      expect(res.disciplines).toEqual([]);
      expect(res.impacts).toEqual([]);
    });

    it('returns empty lists when flair is undefined', () => {
      const res = deriveTaxonomyFromFlair(undefined);
      expect(res.disciplines).toEqual([]);
      expect(res.impacts).toEqual([]);
    });
  });

  describe('evaluateTagPipeline', () => {
    it('merges flair and keyword suggestions into auto-suggested tags', () => {
      const result = evaluateTagPipeline({
        title: 'Novel polymer crystal structure',
        flairText: 'Art & Design',
      });

      expect(result.disciplines).toContain('Arts'); // from flair
      expect(result.disciplines).toContain('Materials'); // from title keyword
      expect(result.disciplinesSource).toBe('auto-suggested');
    });

    it('ignores keyword suggestions when disabled in settings', () => {
      const customRules: TaxonomyMappingRules = {
        ...DEFAULT_TAXONOMY_RULES,
        enableKeywordSuggestions: false,
      };

      const result = evaluateTagPipeline({
        title: 'Robotics gear engine with circuits',
        flairText: 'Biology Showcase',
        rules: customRules,
      });

      expect(result.disciplines).toEqual(['Biology']);
      expect(result.disciplinesSource).toBe('auto-suggested');
    });

    it('deduplicates tags if both flair and keywords match the same discipline', () => {
      const result = evaluateTagPipeline({
        title: 'Single cell biology microscopy',
        flairText: 'Biology Post',
      });

      expect(result.disciplines).toEqual(['Biology']);
      expect(result.disciplinesSource).toBe('auto-suggested');
    });

    it('sets untagged source when neither flair nor keywords match', () => {
      const result = evaluateTagPipeline({
        title: 'Random sunset over the mountain',
        flairText: 'Discussion',
      });

      expect(result.disciplines).toEqual([]);
      expect(result.disciplinesSource).toBe('untagged');
      expect(result.impacts).toEqual([]);
      expect(result.impactsSource).toBe('untagged');
    });
  });

  describe('loadTaxonomyRules', () => {
    it('loads custom flair mappings from settings client', async () => {
      const mockSettings: Record<string, unknown> = {
        enableKeywordSuggestions: false,
        flairsBiology: 'plants, botanical, green',
        flairsGovernment: 'municipal, civic, public',
      };

      const client: SettingsClientContract = {
        get: async (key: string) => mockSettings[key],
      };

      const rules = await loadTaxonomyRules(client);
      expect(rules.enableKeywordSuggestions).toBe(false);
      expect(rules.disciplineFlairs.Biology).toEqual(['plants', 'botanical', 'green']);
      expect(rules.impactFlairs.Government).toEqual(['municipal', 'civic', 'public']);
      // Fallback for unset keys
      expect(rules.disciplineFlairs.Electromagnetics).toEqual(
        DEFAULT_TAXONOMY_RULES.disciplineFlairs.Electromagnetics
      );
    });

    it('gracefully falls back to defaults when settings get throws', async () => {
      const failingClient: SettingsClientContract = {
        get: async () => {
          throw new Error('Devvit config is not available');
        },
      };

      const rules = await loadTaxonomyRules(failingClient);
      expect(rules).toEqual(DEFAULT_TAXONOMY_RULES);
    });
  });
});
