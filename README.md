# addrsplit

Address lists show up as one string per line: `123 Main St Apt 4, Springfield, IL 62704`.
Anything downstream - a mailing tool, a CRM import, a geocoder - wants the pieces
separately: street, unit, city, state, zip. Doing that split by hand across a
file with a few hundred thousand rows is tedious, and doing it by loading the
whole file into memory first is a bad habit that eventually meets a file too
big for that.

addrsplit reads addresses one line at a time and writes one JSON object per
line to stdout, so memory use stays flat no matter how large the input is.

## Usage

```
$ echo "1600 Pennsylvania Ave NW, Washington, DC 20500" | node dist/index.js
{"raw":"1600 Pennsylvania Ave NW, Washington, DC 20500","street":"1600 Pennsylvania Ave NW","unit":null,"city":"Washington","state":"DC","zip":"20500","zip4":null,"valid":true}
```

```
$ node dist/index.js --file addresses.txt > parsed.jsonl
```

Lines that don't match a recognizable address shape come back with
`"valid": false` and null fields instead of stopping the whole run:

```
$ echo "not an address" | node dist/index.js
{"raw":"not an address","street":null,"unit":null,"city":null,"state":null,"zip":null,"zip4":null,"valid":false}
```

## Building

This has no runtime dependencies. To compile the TypeScript sources you need
`typescript` available locally (as a dev tool, not something the CLI depends
on at runtime):

```
npm install --save-dev typescript
npx tsc
node dist/index.js --help
```

## What it currently handles

- `STREET, CITY, STATE ZIP` and `STREET, CITY, STATE ZIP-ZIP4`
- `STREET, CITY STATE ZIP` (city and state run together on the last segment)
- `STREET CITY STATE ZIP` with no commas at all, as long as the street
  segment ends in a recognizable street-type word (`St`, `Ave`, `Blvd`,
  `Rd`, ...), optionally followed by a directional (`NW`, `East`, ...)
- A trailing unit on the street line: `Apt`, `Unit`, `Suite`, `Ste`, `Fl`,
  `Floor`, `Bldg`, `Building`, or a bare `#`

## Known limitations

- Comma-less lines rely on spotting a street-type word to find the
  street/city boundary. A line without one (a PO Box, or a street name that
  doesn't end in a recognized abbreviation) is marked invalid rather than
  guessed at.
- For the same reason, a comma-less city name that starts with a
  directional word - "West Chester", "North Platte" - can be split wrong,
  since that word looks like part of the street ("... Ave West").
- US addresses only; no international formats yet.

See the repo issues / commit history for what's planned next.

## License

MIT, see LICENSE.
