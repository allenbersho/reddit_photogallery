import {
  type Discipline,
  type Impact,
} from '../../shared/taxonomy.js';

// Approved deterministic keyword dictionary for Chimera taxonomy
export const DISCIPLINE_KEYWORDS: Record<Discipline, string[]> = {
  Electromagnetics: [
    'circuit',
    'circuits',
    'magnet',
    'magnets',
    'magnetic',
    'antenna',
    'antennas',
    'rf',
    'voltage',
    'current',
    'resistor',
    'capacitor',
    'inductor',
    'semiconductor',
    'pcb',
    'electronics',
    'electromagnet',
    'electromagnetism',
    'transistor',
    'microwave',
    'optics',
    'photonics',
    'laser',
    'radar',
    'electric',
  ],
  Mechanics: [
    'bridge',
    'bridges',
    'gear',
    'gears',
    'engine',
    'engines',
    'motor',
    'motors',
    'turbine',
    'turbines',
    'robotics',
    'actuator',
    'aerodynamics',
    'flight',
    'vehicle',
    'chassis',
    'suspension',
    'pump',
    'hydraulics',
    'pneumatics',
    'structural',
    'pulley',
    'mechanical',
  ],
  Biology: [
    'cell',
    'cells',
    'animal',
    'animals',
    'plant',
    'plants',
    'anatomy',
    'dna',
    'rna',
    'protein',
    'proteins',
    'organism',
    'microbe',
    'bacteria',
    'virus',
    'fungi',
    'neuron',
    'brain',
    'tissue',
    'genetics',
    'evolution',
    'ecology',
    'wildlife',
    'marine',
    'biological',
  ],
  Mathematics: [
    'geometry',
    'fractal',
    'fractals',
    'proof',
    'proofs',
    'theorem',
    'equation',
    'equations',
    'algebra',
    'calculus',
    'topology',
    'algorithm',
    'combinatorics',
    'matrix',
    'graph theory',
    'prime',
    'symmetry',
    'mathematical',
  ],
  Arts: [
    'painting',
    'paintings',
    'sculpture',
    'sculptures',
    'drawing',
    'drawings',
    'design',
    'illustration',
    'sketch',
    'printmaking',
    'ceramic',
    'calligraphy',
    'digital art',
    'rendering',
    'mural',
    'watercolor',
    'portrait',
    'photography',
    'artistic',
  ],
  Materials: [
    'metal',
    'metals',
    'crystal',
    'crystals',
    'crystalline',
    'polymer',
    'polymers',
    'ceramic',
    'ceramics',
    'alloy',
    'alloys',
    'nanomaterial',
    'composite',
    'graphene',
    'carbon fiber',
    'metallurgy',
    'corrosion',
    'elasticity',
    'tensile',
    'material',
  ],
};

export const IMPACT_KEYWORDS: Record<Impact, string[]> = {
  Self: [
    'self',
    'personal',
    'wearable',
    'prosthetic',
    'individual',
    'body',
    'mental health',
    'wellness',
    'hobby',
  ],
  Home: [
    'home',
    'house',
    'household',
    'kitchen',
    'garden',
    'domestic',
    'indoor',
    'furniture',
    'appliance',
    'backyard',
  ],
  Friends: [
    'friend',
    'friends',
    'peer',
    'classroom',
    'team',
    'collaborative',
    'community',
    'club',
    'social',
    'group',
    'workshop',
  ],
  Government: [
    'government',
    'policy',
    'infrastructure',
    'public',
    'civic',
    'grid',
    'municipal',
    'transportation',
    'regulation',
    'societal',
    'national',
  ],
};

const matchesKeyword = (text: string, keyword: string): boolean => {
  // Case-insensitive word boundary check
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
  return regex.test(text);
};

export const suggestDisciplinesFromTitle = (title: string): Discipline[] => {
  if (!title) {
    return [];
  }
  const suggestions: Discipline[] = [];
  const disciplines = Object.keys(DISCIPLINE_KEYWORDS) as Discipline[];

  for (const discipline of disciplines) {
    const keywords = DISCIPLINE_KEYWORDS[discipline];
    if (keywords.some((kw) => matchesKeyword(title, kw))) {
      suggestions.push(discipline);
    }
  }

  return suggestions;
};

export const suggestImpactsFromTitle = (title: string): Impact[] => {
  if (!title) {
    return [];
  }
  const suggestions: Impact[] = [];
  const impacts = Object.keys(IMPACT_KEYWORDS) as Impact[];

  for (const impact of impacts) {
    const keywords = IMPACT_KEYWORDS[impact];
    if (keywords.some((kw) => matchesKeyword(title, kw))) {
      suggestions.push(impact);
    }
  }

  return suggestions;
};
