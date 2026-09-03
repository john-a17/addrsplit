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

// Handles the common "STREET, CITY, STATE ZIP" shape, and the looser
// "STREET, CITY STATE ZIP" shape where the last comma was dropped. A line
// with no comma at all isn't handled yet - see README roadmap.
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
    return emptyResult(raw);
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
