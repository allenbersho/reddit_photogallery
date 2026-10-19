export const CHIMERA_DISCIPLINES = [
  'Electromagnetics',
  'Mechanics',
  'Biology',
  'Mathematics',
  'Arts',
  'Materials',
] as const;

export type Discipline = (typeof CHIMERA_DISCIPLINES)[number];

export const CHIMERA_IMPACTS = [
  'Self',
  'Home',
  'Friends',
  'Government',
] as const;

export type Impact = (typeof CHIMERA_IMPACTS)[number];

export type TagSource =
  | 'unverified'
  | 'auto-suggested'
  | 'poster-tagged'
  | 'mod-verified'
  | 'untagged';

export const TAG_SOURCE_PRIORITY: Record<TagSource, number> = {
  untagged: 0,
  unverified: 1,
  'auto-suggested': 2,
  'poster-tagged': 3,
  'mod-verified': 4,
};

export const canOverrideTagSource = (
  existingSource: TagSource | undefined,
  newSource: TagSource
): boolean => {
  if (!existingSource) {
    return true;
  }
  const existingPriority = TAG_SOURCE_PRIORITY[existingSource] ?? 0;
  const newPriority = TAG_SOURCE_PRIORITY[newSource] ?? 0;
  return newPriority >= existingPriority;
};

// Pastel colors matching Chimera University catalog
export const DISCIPLINE_COLORS: Record<
  Discipline,
  { bg: string; text: string; border: string }
> = {
  Electromagnetics: { bg: '#a0d8f1', text: '#21343a', border: '#7ec4e6' },
  Mechanics: { bg: '#f7c59f', text: '#21343a', border: '#e8aa7a' },
  Biology: { bg: '#a8e6cf', text: '#162228', border: '#81d4b6' },
  Mathematics: { bg: '#cbb2fe', text: '#21343a', border: '#b291fb' },
  Arts: { bg: '#f8a1d1', text: '#162228', border: '#e97bb9' },
  Materials: { bg: '#9de3e0', text: '#21343a', border: '#7cd0cd' },
};

export const IMPACT_COLORS: Record<
  Impact,
  { bg: string; text: string; border: string }
> = {
  Self: { bg: '#d4e6f1', text: '#1b4f72', border: '#a9cce3' },
  Home: { bg: '#d5f5e3', text: '#196f3d', border: '#a9dfbf' },
  Friends: { bg: '#fdebd0', text: '#7e5109', border: '#f8c471' },
  Government: { bg: '#ebdef0', text: '#512e5f', border: '#d7bde2' },
};

export const isDiscipline = (value: string): value is Discipline => {
  return (CHIMERA_DISCIPLINES as readonly string[]).includes(value);
};

export const isImpact = (value: string): value is Impact => {
  return (CHIMERA_IMPACTS as readonly string[]).includes(value);
};

export const validateDisciplines = (values: unknown): Discipline[] => {
  if (!Array.isArray(values)) {
    return [];
  }
  const validated: Discipline[] = [];
  for (const item of values) {
    if (typeof item === 'string' && isDiscipline(item)) {
      if (!validated.includes(item)) {
        validated.push(item);
      }
    }
  }
  return validated;
};

export const validateImpacts = (values: unknown): Impact[] => {
  if (!Array.isArray(values)) {
    return [];
  }
  const validated: Impact[] = [];
  for (const item of values) {
    if (typeof item === 'string' && isImpact(item)) {
      if (!validated.includes(item)) {
        validated.push(item);
      }
    }
  }
  return validated;
};
