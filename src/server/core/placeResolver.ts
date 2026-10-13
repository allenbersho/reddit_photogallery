import type { PlaceLocation, PlaceStatus } from '../../shared/types.js';
import {
  COUNTRIES,
  GAZETTEER_ENTRIES,
  type CountryInfo,
  type GazetteerEntry,
} from '../data/gazetteer.js';

export type ResolvedPlace = {
  raw: string;
  country: string; // ISO 3166-1 alpha-2 (e.g. "JP", "US", "FR")
  countryName: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  confidence: 'exact' | 'high' | 'country-only';
};

export type PlaceResolutionResult =
  | {
      status: 'resolved';
      place: ResolvedPlace;
    }
  | {
      status: 'ambiguous';
      raw: string;
      candidates: ResolvedPlace[];
    }
  | {
      status: 'unresolved';
      raw: string;
    };

export const cleanLocationText = (input: string): string => {
  let cleaned = input.trim();
  // Strip enclosing brackets [ ... ] or ( ... )
  if (
    (cleaned.startsWith('[') && cleaned.endsWith(']')) ||
    (cleaned.startsWith('(') && cleaned.endsWith(')'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Strip known location prefixes like "location:", "place:", "taken in:"
  const prefixRegex =
    /^(location|place|taken in|shot in|photo in|photographed in)\s*:\s*/i;
  cleaned = cleaned.replace(prefixRegex, '').trim();

  // Normalize excessive spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
};

const normalizeToken = (token: string): string =>
  token
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim();

const findCountry = (token: string): CountryInfo | undefined => {
  const norm = normalizeToken(token);
  if (!norm) return undefined;

  for (const c of COUNTRIES) {
    if (
      c.code.toLowerCase() === norm ||
      c.normalizedName === norm ||
      c.aliases?.some((a) => a.toLowerCase() === norm)
    ) {
      return c;
    }
  }
  return undefined;
};

const matchesCountry = (entry: GazetteerEntry, token: string): boolean => {
  const norm = normalizeToken(token);
  if (!norm) return false;
  if (entry.country.toLowerCase() === norm) return true;
  if (entry.normalizedCountryName === norm) return true;
  const countryObj = COUNTRIES.find((c) => c.code === entry.country);
  if (countryObj?.aliases?.some((a) => a.toLowerCase() === norm)) {
    return true;
  }
  return false;
};

const matchesRegion = (entry: GazetteerEntry, token: string): boolean => {
  const norm = normalizeToken(token);
  if (!norm) return false;
  if (entry.normalizedRegion === norm) return true;
  if (
    entry.normalizedRegion.includes(norm) ||
    norm.includes(entry.normalizedRegion)
  ) {
    return true;
  }
  // Check common US state abbreviations
  const usStateMap: Record<string, string> = {
    ma: 'massachusetts',
    ca: 'california',
    ny: 'new york',
    wa: 'washington',
    tx: 'texas',
    il: 'illinois',
    co: 'colorado',
    or: 'oregon',
    fl: 'florida',
    ga: 'georgia',
    hi: 'hawaii',
  };
  const mapped = usStateMap[norm];
  if (mapped && mapped === entry.normalizedRegion) {
    return true;
  }
  return false;
};

const matchesCityOrAlias = (entry: GazetteerEntry, token: string): boolean => {
  const norm = normalizeToken(token);
  if (!norm) return false;
  if (entry.normalizedCity === norm) return true;
  if (entry.aliases?.some((a) => normalizeToken(a) === norm)) return true;
  return false;
};

export const resolvePlace = (input: string): PlaceResolutionResult => {
  const cleaned = cleanLocationText(input);
  if (!cleaned) {
    return { status: 'unresolved', raw: input };
  }

  // 1. Check if the input contains comma/semicolon/hyphen parts: e.g. "Paris, France" or "Cambridge, MA, USA"
  const parts = cleaned
    .split(/[,;/]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length >= 2) {
    const firstPart = parts[0] ?? '';
    const lastPart = parts[parts.length - 1] ?? '';
    const middlePart = parts.length > 2 ? parts[1] : undefined;

    // Filter matching city entries
    const matchingEntries = GAZETTEER_ENTRIES.filter((entry) =>
      matchesCityOrAlias(entry, firstPart)
    );

    if (matchingEntries.length > 0) {
      // Disambiguate with remaining parts
      const filtered = matchingEntries.filter((entry) => {
        const countryMatch = matchesCountry(entry, lastPart);
        const regionMatch =
          matchesRegion(entry, lastPart) ||
          (middlePart ? matchesRegion(entry, middlePart) : false);
        return countryMatch || regionMatch;
      });

      if (filtered.length === 1) {
        const match = filtered[0];
        if (match) {
          return {
            status: 'resolved',
            place: {
              raw: cleaned,
              country: match.country,
              countryName: match.countryName,
              region: match.region,
              city: match.city,
              latitude: match.latitude,
              longitude: match.longitude,
              confidence: 'exact',
            },
          };
        }
      }

      if (filtered.length > 1) {
        return {
          status: 'ambiguous',
          raw: cleaned,
          candidates: filtered.map((match) => ({
            raw: cleaned,
            country: match.country,
            countryName: match.countryName,
            region: match.region,
            city: match.city,
            latitude: match.latitude,
            longitude: match.longitude,
            confidence: 'exact',
          })),
        };
      }
    }
  }

  // 2. Direct single token or phrase lookup
  const singleNormalized = normalizeToken(cleaned);
  const cityMatches = GAZETTEER_ENTRIES.filter((entry) =>
    matchesCityOrAlias(entry, cleaned)
  );

  if (cityMatches.length === 1) {
    const match = cityMatches[0];
    if (match) {
      return {
        status: 'resolved',
        place: {
          raw: cleaned,
          country: match.country,
          countryName: match.countryName,
          region: match.region,
          city: match.city,
          latitude: match.latitude,
          longitude: match.longitude,
          confidence: 'high',
        },
      };
    }
  }

  // If multiple distinct cities match without disambiguating context, flag ambiguity
  if (cityMatches.length > 1) {
    // Check if they are truly different cities (different country or region)
    const distinct = cityMatches.filter(
      (item, idx, arr) =>
        arr.findIndex(
          (other) =>
            other.country === item.country && other.region === item.region
        ) === idx
    );

    if (distinct.length > 1) {
      return {
        status: 'ambiguous',
        raw: cleaned,
        candidates: distinct.map((match) => ({
          raw: cleaned,
          country: match.country,
          countryName: match.countryName,
          region: match.region,
          city: match.city,
          latitude: match.latitude,
          longitude: match.longitude,
          confidence: 'high',
        })),
      };
    }
  }

  // 3. Country-level match
  const countryObj = findCountry(singleNormalized);
  if (countryObj) {
    return {
      status: 'resolved',
      place: {
        raw: cleaned,
        country: countryObj.code,
        countryName: countryObj.name,
        region: '',
        city: '',
        latitude: countryObj.latitude,
        longitude: countryObj.longitude,
        confidence: 'country-only',
      },
    };
  }

  return { status: 'unresolved', raw: cleaned };
};

export const toPlaceLocation = (
  resolved: ResolvedPlace,
  status: PlaceStatus
): PlaceLocation => ({
  raw: resolved.raw,
  country: resolved.country,
  region: resolved.region,
  city: resolved.city,
  latitude: resolved.latitude,
  longitude: resolved.longitude,
  status,
});
