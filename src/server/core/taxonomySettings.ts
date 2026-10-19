import { settings } from '@devvit/web/server';
import {
  CHIMERA_DISCIPLINES,
  CHIMERA_IMPACTS,
  type Discipline,
  type Impact,
  type TagSource,
} from '../../shared/taxonomy.js';
import {
  suggestDisciplinesFromTitle,
  suggestImpactsFromTitle,
} from './keywordSuggester.js';
import type { SettingsClientContract } from './topicSettings.js';

export type TaxonomyMappingRules = {
  enableKeywordSuggestions: boolean;
  disciplineFlairs: Record<Discipline, string[]>;
  impactFlairs: Record<Impact, string[]>;
};

export const DEFAULT_TAXONOMY_RULES: TaxonomyMappingRules = {
  enableKeywordSuggestions: true,
  disciplineFlairs: {
    Electromagnetics: [
      'electromagnetics',
      'circuit',
      'radio',
      'rf',
      'antenna',
      'pcb',
      'electronics',
    ],
    Mechanics: [
      'mechanics',
      'robotics',
      'engine',
      'mechanical',
      'structure',
      'vehicle',
    ],
    Biology: [
      'biology',
      'bio',
      'cell',
      'flora',
      'fauna',
      'nature',
      'anatomy',
      'dna',
      'wildlife',
    ],
    Mathematics: [
      'mathematics',
      'math',
      'geometry',
      'fractal',
      'proof',
      'algorithm',
    ],
    Arts: [
      'arts',
      'art',
      'sculpture',
      'painting',
      'photography',
      'design',
      'drawing',
    ],
    Materials: [
      'materials',
      'material',
      'crystal',
      'polymer',
      'alloy',
      'metallurgy',
    ],
  },
  impactFlairs: {
    Self: ['self', 'personal', 'wearable', 'wellness'],
    Home: ['home', 'domestic', 'house', 'indoor'],
    Friends: ['friends', 'team', 'peer', 'club', 'social'],
    Government: ['government', 'public', 'civic', 'infrastructure', 'policy'],
  },
};

const parseKeywords = (csv?: string | null): string[] => {
  if (!csv) {
    return [];
  }
  return csv
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
};

export const loadTaxonomyRules = async (
  client?: SettingsClientContract
): Promise<TaxonomyMappingRules> => {
  const settingsClient = client ?? settings;
  if (!settingsClient) {
    return DEFAULT_TAXONOMY_RULES;
  }

  try {
    const [
      kwSuggestVal,
      flairEM,
      flairMech,
      flairBio,
      flairMath,
      flairArts,
      flairMat,
      flairSelf,
      flairHome,
      flairFriends,
      flairGov,
    ] = await Promise.all([
      settingsClient.get('enableKeywordSuggestions'),
      settingsClient.get('flairsElectromagnetics'),
      settingsClient.get('flairsMechanics'),
      settingsClient.get('flairsBiology'),
      settingsClient.get('flairsMathematics'),
      settingsClient.get('flairsArts'),
      settingsClient.get('flairsMaterials'),
      settingsClient.get('flairsSelf'),
      settingsClient.get('flairsHome'),
      settingsClient.get('flairsFriends'),
      settingsClient.get('flairsGovernment'),
    ]);

    const enableKeywordSuggestions =
      typeof kwSuggestVal === 'boolean'
        ? kwSuggestVal
        : DEFAULT_TAXONOMY_RULES.enableKeywordSuggestions;

    const getKeywordsOrDefault = (
      val: unknown,
      defaults: string[]
    ): string[] => {
      if (typeof val === 'string') {
        const parsed = parseKeywords(val);
        if (parsed.length > 0) {
          return parsed;
        }
      }
      return defaults;
    };

    const disciplineFlairs: Record<Discipline, string[]> = {
      Electromagnetics: getKeywordsOrDefault(
        flairEM,
        DEFAULT_TAXONOMY_RULES.disciplineFlairs.Electromagnetics
      ),
      Mechanics: getKeywordsOrDefault(
        flairMech,
        DEFAULT_TAXONOMY_RULES.disciplineFlairs.Mechanics
      ),
      Biology: getKeywordsOrDefault(
        flairBio,
        DEFAULT_TAXONOMY_RULES.disciplineFlairs.Biology
      ),
      Mathematics: getKeywordsOrDefault(
        flairMath,
        DEFAULT_TAXONOMY_RULES.disciplineFlairs.Mathematics
      ),
      Arts: getKeywordsOrDefault(
        flairArts,
        DEFAULT_TAXONOMY_RULES.disciplineFlairs.Arts
      ),
      Materials: getKeywordsOrDefault(
        flairMat,
        DEFAULT_TAXONOMY_RULES.disciplineFlairs.Materials
      ),
    };

    const impactFlairs: Record<Impact, string[]> = {
      Self: getKeywordsOrDefault(
        flairSelf,
        DEFAULT_TAXONOMY_RULES.impactFlairs.Self
      ),
      Home: getKeywordsOrDefault(
        flairHome,
        DEFAULT_TAXONOMY_RULES.impactFlairs.Home
      ),
      Friends: getKeywordsOrDefault(
        flairFriends,
        DEFAULT_TAXONOMY_RULES.impactFlairs.Friends
      ),
      Government: getKeywordsOrDefault(
        flairGov,
        DEFAULT_TAXONOMY_RULES.impactFlairs.Government
      ),
    };

    return {
      enableKeywordSuggestions,
      disciplineFlairs,
      impactFlairs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Devvit config is not available')) {
      console.warn(
        'Failed to load taxonomy flair settings, using defaults:',
        message
      );
    }
    return DEFAULT_TAXONOMY_RULES;
  }
};

const matchFlairTerm = (text: string, term: string): boolean => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return regex.test(text);
};

export const deriveTaxonomyFromFlair = (
  flairText?: string,
  rules: TaxonomyMappingRules = DEFAULT_TAXONOMY_RULES
): { disciplines: Discipline[]; impacts: Impact[] } => {
  if (!flairText) {
    return { disciplines: [], impacts: [] };
  }
  const normalized = flairText.toLowerCase();

  const disciplines: Discipline[] = [];
  for (const d of CHIMERA_DISCIPLINES) {
    const kws = rules.disciplineFlairs[d] ?? [];
    if (kws.some((kw) => matchFlairTerm(normalized, kw))) {
      disciplines.push(d);
    }
  }

  const impacts: Impact[] = [];
  for (const imp of CHIMERA_IMPACTS) {
    const kws = rules.impactFlairs[imp] ?? [];
    if (kws.some((kw) => matchFlairTerm(normalized, kw))) {
      impacts.push(imp);
    }
  }

  return { disciplines, impacts };
};

export type TagPipelineResult = {
  disciplines: Discipline[];
  disciplinesSource: TagSource;
  impacts: Impact[];
  impactsSource: TagSource;
};

export const evaluateTagPipeline = ({
  title,
  flairText,
  rules = DEFAULT_TAXONOMY_RULES,
}: {
  title?: string;
  flairText?: string;
  rules?: TaxonomyMappingRules;
}): TagPipelineResult => {
  // 1. Flair mapping evaluation
  const fromFlair = deriveTaxonomyFromFlair(flairText, rules);

  // 2. Keyword suggestion evaluation (if enabled)
  let fromKeywordsDisciplines: Discipline[] = [];
  let fromKeywordsImpacts: Impact[] = [];
  if (rules.enableKeywordSuggestions && title) {
    fromKeywordsDisciplines = suggestDisciplinesFromTitle(title);
    fromKeywordsImpacts = suggestImpactsFromTitle(title);
  }

  // Merge disciplines (deduplicated)
  const combinedDisciplines = Array.from(
    new Set([...fromFlair.disciplines, ...fromKeywordsDisciplines])
  );
  const disciplinesSource: TagSource =
    combinedDisciplines.length > 0 ? 'auto-suggested' : 'untagged';

  // Merge impacts (deduplicated)
  const combinedImpacts = Array.from(
    new Set([...fromFlair.impacts, ...fromKeywordsImpacts])
  );
  const impactsSource: TagSource =
    combinedImpacts.length > 0 ? 'auto-suggested' : 'untagged';

  return {
    disciplines: combinedDisciplines,
    disciplinesSource,
    impacts: combinedImpacts,
    impactsSource,
  };
};
