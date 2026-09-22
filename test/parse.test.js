'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAddress } = require('../dist/parse');

// Each fixture is [input line, expected fields excluding "raw" and "valid",
// which are derived from the input and the presence of the fixture in
// validCases/invalidCases below].
const validCases = [
  {
    line: '123 Main St, Springfield, IL 62704',
    street: '123 Main St',
    unit: null,
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: null,
  },
  {
    line: '123 Main St, Springfield, IL 62704-1234',
    street: '123 Main St',
    unit: null,
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: '1234',
  },
  {
    line: '123 Main St Apt 4B, Springfield, IL 62704',
    street: '123 Main St',
    unit: '4B',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: null,
  },
  {
    line: '123 Main St #4B, Springfield, IL 62704',
    street: '123 Main St',
    unit: '4B',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: null,
  },
  {
    // last comma dropped: city and state run together in the final segment
    line: '123 Main St, Springfield IL 62704',
    street: '123 Main St',
    unit: null,
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: null,
  },
  {
    // unit carried as its own comma segment rather than on the street line
    line: '123 Main St, Apt 4, Springfield IL 62704',
    street: '123 Main St',
    unit: '4',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: null,
  },
  {
    // no commas at all; street suffix + directional mark the street/city split
    line: '1600 Pennsylvania Ave NW Washington DC 20500',
    street: '1600 Pennsylvania Ave NW',
    unit: null,
    city: 'Washington',
    state: 'DC',
    zip: '20500',
    zip4: null,
  },
  {
    line: '123 Main St Apt 4 Springfield IL 62704',
    street: '123 Main St',
    unit: '4',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: null,
  },
  {
    line: '123 Main St # 4B Springfield IL 62704',
    street: '123 Main St',
    unit: '4B',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    zip4: null,
  },
  {
    // documented known limitation: a comma-less city starting with a
    // directional word gets folded into the street instead of the city
    line: '100 Main St West Chester PA 19380',
    street: '100 Main St West',
    unit: null,
    city: 'Chester',
    state: 'PA',
    zip: '19380',
    zip4: null,
  },
];

const invalidCases = [
  'not an address',
  '',
  '   ',
  // comma-less with no recognizable street suffix - can't find the
  // street/city boundary, so it's rejected rather than guessed at
  'PO Box 123 Springfield IL 62704',
  // comma-less with a suffix but nothing after it to be a city
  '123 Main St IL 62704',
];

test('parses recognized address shapes', () => {
  for (const fixture of validCases) {
    const { line, ...expectedFields } = fixture;
    const result = parseAddress(line);
    assert.deepEqual(result, {
      raw: line.trim(),
      ...expectedFields,
      valid: true,
    });
  }
});

test('rejects lines that do not match a known shape', () => {
  for (const line of invalidCases) {
    const result = parseAddress(line);
    assert.equal(result.valid, false);
    assert.equal(result.raw, line.trim());
    assert.equal(result.street, null);
    assert.equal(result.unit, null);
    assert.equal(result.city, null);
    assert.equal(result.state, null);
    assert.equal(result.zip, null);
    assert.equal(result.zip4, null);
  }
});

test('trims surrounding whitespace before parsing', () => {
  const result = parseAddress('  123 Main St, Springfield, IL 62704  ');
  assert.equal(result.raw, '123 Main St, Springfield, IL 62704');
  assert.equal(result.valid, true);
});
