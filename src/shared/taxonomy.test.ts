import { describe, expect, it } from 'vitest';
import {
  CHIMERA_DISCIPLINES,
  CHIMERA_IMPACTS,
  canOverrideTagSource,
  isDiscipline,
  isImpact,
  validateDisciplines,
  validateImpacts,
} from './taxonomy.js';

describe('Chimera taxonomy config', () => {
  it('contains the exact 6 disciplines with correct casing', () => {
    expect(CHIMERA_DISCIPLINES).toEqual([
      'Electromagnetics',
      'Mechanics',
      'Biology',
      'Mathematics',
      'Arts',
      'Materials',
    ]);
  });

  it('contains the exact 4 impacts with correct casing', () => {
    expect(CHIMERA_IMPACTS).toEqual([
      'Self',
      'Home',
      'Friends',
      'Government',
    ]);
  });

  it('correctly identifies valid and invalid discipline names', () => {
    expect(isDiscipline('Biology')).toBe(true);
    expect(isDiscipline('Electromagnetics')).toBe(true);
    expect(isDiscipline('biology')).toBe(false);
    expect(isDiscipline('Physics')).toBe(false);
    expect(isDiscipline('All Disciplines')).toBe(false);
  });

  it('correctly identifies valid and invalid impact names', () => {
    expect(isImpact('Home')).toBe(true);
    expect(isImpact('Government')).toBe(true);
    expect(isImpact('home')).toBe(false);
    expect(isImpact('Society')).toBe(false);
    expect(isImpact('All Impacts')).toBe(false);
  });

  it('validates and deduplicates discipline arrays', () => {
    const raw = ['Biology', 'Materials', 'Invalid', 'Biology', 123, null];
    const result = validateDisciplines(raw);
    expect(result).toEqual(['Biology', 'Materials']);
  });

  it('validates and deduplicates impact arrays', () => {
    const raw = ['Home', 'Friends', 'Home', 'World'];
    const result = validateImpacts(raw);
    expect(result).toEqual(['Home', 'Friends']);
  });

  it('enforces tag source priority correctly', () => {
    expect(canOverrideTagSource('auto-suggested', 'poster-tagged')).toBe(true);
    expect(canOverrideTagSource('poster-tagged', 'mod-verified')).toBe(true);
    expect(canOverrideTagSource('mod-verified', 'auto-suggested')).toBe(false);
    expect(canOverrideTagSource('mod-verified', 'poster-tagged')).toBe(false);
    expect(canOverrideTagSource('mod-verified', 'mod-verified')).toBe(true);
    expect(canOverrideTagSource(undefined, 'auto-suggested')).toBe(true);
  });
});
