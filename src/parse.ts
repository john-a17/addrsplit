export interface ParsedAddress {
  raw: string;
  street: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  zip4: string | null;
  valid: boolean;
}

const UNIT_PATTERN =
  /[,\s]+(apt|apartment|unit|suite|ste|fl|floor|bldg|building|#)\.?\s*#?\s*([a-z0-9-]+)\s*$/i;

const STATE_ZIP_PATTERN = /^(.*?)\s*\b([A-Za-z]{2})\s+(\d{5})(?:-(\d{4}))?\s*$/;

const COMMALESS_TAIL_PATTERN = /^(.*\S)\s+([A-Za-z]{2})\s+(\d{5})(?:-(\d{4}))?$/;

// Common street-type abbreviations. Used only to find where a street segment
// ends when there's no comma to mark the boundary - see parseCommaless.
const STREET_SUFFIXES = new Set([
  'ST', 'STREET', 'AVE', 'AVENUE', 'BLVD', 'BOULEVARD', 'DR', 'DRIVE',
  'RD', 'ROAD', 'LN', 'LANE', 'WAY', 'CT', 'COURT', 'PL', 'PLACE',
  'TER', 'TERR', 'TERRACE', 'PKWY', 'PARKWAY', 'CIR', 'CIRCLE', 'HWY',
  'HIGHWAY', 'TRL', 'TRAIL', 'LOOP', 'SQ', 'SQUARE', 'ALY', 'ALLEY',
  'ROW', 'RUN', 'PATH', 'PIKE', 'WALK', 'PLZ', 'PLAZA',
]);

const DIRECTIONALS = new Set([
  'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW',
  'NORTH', 'SOUTH', 'EAST', 'WEST',
  'NORTHEAST', 'NORTHWEST', 'SOUTHEAST', 'SOUTHWEST',
]);

const UNIT_KEYWORDS = new Set([
  'APT', 'APARTMENT', 'UNIT', 'SUITE', 'STE', 'FL', 'FLOOR', 'BLDG', 'BUILDING',
]);

function normalizeWord(word: string): string {
  return word.replace(/\.$/, '').toUpperCase();
}

function emptyResult(raw: string): ParsedAddress {
  return {
    raw,
    street: null,
    unit: null,
    city: null,
    state: null,
    zip: null,
    zip4: null,
    valid: false,
  };
}

// Pulls a trailing "Apt 4B" / "Suite 200" / "#12" off a street line. Addresses
// almost never carry a unit anywhere but the end of the street segment, so we
// only look there rather than scanning the whole string.
function splitUnit(streetRaw: string): { street: string; unit: string | null } {
  const match = streetRaw.match(UNIT_PATTERN);
  if (!match) {
    return { street: streetRaw.trim(), unit: null };
  }
  const unit = match[2].toUpperCase();
  const street = streetRaw.slice(0, match.index).trim();
  return { street, unit };
}

function splitStateZip(
  segment: string
): { cityFragment: string | null; state: string; zip: string; zip4: string | null } | null {
  const match = segment.match(STATE_ZIP_PATTERN);
  if (!match) {
    return null;
  }
  return {
    cityFragment: match[1].trim() || null,
    state: match[2].toUpperCase(),
    zip: match[3],
    zip4: match[4] ?? null,
  };
}

// A comma-less line has no punctuation to mark where the street segment
// ends, so we fall back to recognizing a trailing state + zip and then a
// street-type word (St, Ave, Blvd, ...) to find the street/city boundary.
// A directional right after the suffix ("Ave NW") is kept with the street;
// anything past that is the city. This is a heuristic, not a gazetteer, so
// a city name that happens to start with a directional word (e.g. "West
// Chester") will be split wrong - see README limitations.
function parseCommaless(raw: string): ParsedAddress {
  const tailMatch = raw.match(COMMALESS_TAIL_PATTERN);
  if (!tailMatch) {
    return emptyResult(raw);
  }

  const state = tailMatch[2].toUpperCase();
  const zip = tailMatch[3];
  const zip4 = tailMatch[4] ?? null;
  const words = tailMatch[1].split(/\s+/);

  let suffixIndex = -1;
  for (let i = 0; i < words.length; i++) {
    if (STREET_SUFFIXES.has(normalizeWord(words[i]))) {
      suffixIndex = i;
      break;
    }
  }
  if (suffixIndex === -1 || suffixIndex === words.length - 1) {
    return emptyResult(raw);
  }

  let streetEnd = suffixIndex;
  let cursor = suffixIndex + 1;

  if (cursor < words.length && DIRECTIONALS.has(normalizeWord(words[cursor]))) {
    streetEnd = cursor;
    cursor++;
  }

  let unit: string | null = null;
  if (cursor < words.length) {
    const word = words[cursor];
    if (word === '#' && cursor + 1 < words.length) {
      unit = words[cursor + 1].toUpperCase();
      cursor += 2;
    } else if (word.startsWith('#') && word.length > 1) {
      unit = word.slice(1).toUpperCase();
      cursor += 1;
    } else if (UNIT_KEYWORDS.has(normalizeWord(word)) && cursor + 1 < words.length) {
      unit = words[cursor + 1].toUpperCase();
      cursor += 2;
    }
  }

  const cityWords = words.slice(cursor);
  if (cityWords.length === 0) {
    return emptyResult(raw);
  }

  const street = words.slice(0, streetEnd + 1).join(' ');
  const city = cityWords.join(' ');

  return {
    raw,
    street,
    unit,
    city,
    state,
    zip,
    zip4,
    valid: true,
  };
}

// Handles the common "STREET, CITY, STATE ZIP" shape, the looser
// "STREET, CITY STATE ZIP" shape where the last comma was dropped, and (via
// parseCommaless) lines with no comma at all.
export function parseAddress(line: string): ParsedAddress {
  const raw = line.trim();
  if (!raw) {
    return emptyResult(raw);
  }

  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length < 2) {
    return parseCommaless(raw);
  }

  const last = parts[parts.length - 1];
  const tail = splitStateZip(last);
  if (!tail) {
    return emptyResult(raw);
  }

  let cityRaw: string | null;
  let streetRaw: string;

  if (parts.length >= 3 && !tail.cityFragment) {
    cityRaw = parts[parts.length - 2];
    streetRaw = parts.slice(0, parts.length - 2).join(', ');
  } else {
    cityRaw = tail.cityFragment;
    streetRaw = parts.slice(0, parts.length - 1).join(', ');
  }

  if (!cityRaw || !streetRaw) {
    return emptyResult(raw);
  }

  const { street, unit } = splitUnit(streetRaw);

  return {
    raw,
    street: street || null,
    unit,
    city: cityRaw,
    state: tail.state,
    zip: tail.zip,
    zip4: tail.zip4,
    valid: true,
  };
}
