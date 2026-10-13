import { describe, expect, it } from 'vitest';
import {
  cleanLocationText,
  resolvePlace,
  toPlaceLocation,
} from './placeResolver.js';

describe('placeResolver', () => {
  describe('cleanLocationText', () => {
    it('strips enclosing brackets', () => {
      expect(cleanLocationText('[Tokyo, Japan]')).toBe('Tokyo, Japan');
      expect(cleanLocationText('(Paris, France)')).toBe('Paris, France');
    });

    it('strips location prefixes', () => {
      expect(cleanLocationText('Location: Geneva, Switzerland')).toBe(
        'Geneva, Switzerland'
      );
      expect(cleanLocationText('taken in: Berlin, Germany')).toBe(
        'Berlin, Germany'
      );
      expect(cleanLocationText('Place: San Francisco, CA')).toBe(
        'San Francisco, CA'
      );
    });

    it('normalizes excessive whitespace', () => {
      expect(cleanLocationText('  London ,   UK  ')).toBe('London , UK');
    });
  });

  describe('resolvePlace', () => {
    it('resolves exact "City, Country" matches', () => {
      const res = resolvePlace('Paris, France');
      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.place.city).toBe('Paris');
        expect(res.place.country).toBe('FR');
        expect(res.place.countryName).toBe('France');
        expect(res.place.latitude).toBeCloseTo(48.8566);
      }
    });

    it('resolves exact "City, State/Region" matches', () => {
      const res = resolvePlace('Seattle, Washington');
      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.place.city).toBe('Seattle');
        expect(res.place.region).toBe('Washington');
        expect(res.place.country).toBe('US');
      }
    });

    it('resolves US state abbreviations like "Cambridge, MA"', () => {
      const res = resolvePlace('Cambridge, MA');
      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.place.city).toBe('Cambridge');
        expect(res.place.region).toBe('Massachusetts');
        expect(res.place.country).toBe('US');
      }
    });

    it('resolves UK country designation like "Cambridge, UK"', () => {
      const res = resolvePlace('Cambridge, UK');
      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.place.city).toBe('Cambridge');
        expect(res.place.country).toBe('GB');
      }
    });

    it('detects ambiguity when city name is shared and no region/country given', () => {
      const res = resolvePlace('Cambridge');
      expect(res.status).toBe('ambiguous');
      if (res.status === 'ambiguous') {
        expect(res.candidates.length).toBeGreaterThanOrEqual(2);
        const countries = res.candidates.map((c) => c.country);
        expect(countries).toContain('US');
        expect(countries).toContain('GB');
      }
    });

    it('resolves single unique cities without country token', () => {
      const res = resolvePlace('Tokyo');
      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.place.city).toBe('Tokyo');
        expect(res.place.country).toBe('JP');
      }
    });

    it('resolves popular aliases', () => {
      const nyc = resolvePlace('NYC');
      expect(nyc.status).toBe('resolved');
      if (nyc.status === 'resolved') {
        expect(nyc.place.city).toBe('New York');
        expect(nyc.place.country).toBe('US');
      }

      const cern = resolvePlace('CERN');
      expect(cern.status).toBe('resolved');
      if (cern.status === 'resolved') {
        expect(cern.place.city).toBe('Geneva');
        expect(cern.place.country).toBe('CH');
      }
    });

    it('resolves country-only names', () => {
      const res = resolvePlace('Switzerland');
      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        expect(res.place.country).toBe('CH');
        expect(res.place.countryName).toBe('Switzerland');
        expect(res.place.city).toBe('');
        expect(res.place.confidence).toBe('country-only');
      }

      const usa = resolvePlace('USA');
      expect(usa.status).toBe('resolved');
      if (usa.status === 'resolved') {
        expect(usa.place.country).toBe('US');
      }
    });

    it('returns unresolved for unknown places', () => {
      const res = resolvePlace('Fictional Atlantis 9999');
      expect(res.status).toBe('unresolved');
      if (res.status === 'unresolved') {
        expect(res.raw).toBe('Fictional Atlantis 9999');
      }
    });

    it('converts resolved place to PlaceLocation structure', () => {
      const res = resolvePlace('Tokyo, Japan');
      expect(res.status).toBe('resolved');
      if (res.status === 'resolved') {
        const placeLocation = toPlaceLocation(res.place, 'poster-tagged');
        expect(placeLocation.city).toBe('Tokyo');
        expect(placeLocation.country).toBe('JP');
        expect(placeLocation.status).toBe('poster-tagged');
        expect(placeLocation.latitude).toBeCloseTo(35.6762);
      }
    });
  });
});
