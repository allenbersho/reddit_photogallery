import { describe, expect, it } from 'vitest';
import type { DisciplineFilter, ImpactFilter } from '../../shared/types.js';

describe('client timeline query parameter builder', () => {
  it('formats single and multiple disciplines and impacts into URLSearchParams', () => {
    const disciplines: DisciplineFilter[] = ['Biology', 'Arts'];
    const impacts: ImpactFilter[] = ['Self', 'Home'];

    const params = new URLSearchParams();
    params.set('limit', '30');
    if (disciplines.length > 0) {
      params.set('disciplines', disciplines.join(','));
    }
    if (impacts.length > 0) {
      params.set('impacts', impacts.join(','));
    }

    expect(params.get('disciplines')).toBe('Biology,Arts');
    expect(params.get('impacts')).toBe('Self,Home');
    expect(params.toString()).toBe(
      'limit=30&disciplines=Biology%2CArts&impacts=Self%2CHome'
    );
  });

  it('handles untagged filter parameters', () => {
    const disciplines: DisciplineFilter[] = ['untagged'];
    const impacts: ImpactFilter[] = ['untagged'];

    const params = new URLSearchParams();
    params.set('disciplines', disciplines.join(','));
    params.set('impacts', impacts.join(','));

    expect(params.get('disciplines')).toBe('untagged');
    expect(params.get('impacts')).toBe('untagged');
  });
});
