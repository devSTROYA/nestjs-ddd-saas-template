import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { APP_CONFIGS } from './config-sets.js';

// INFO: The runner sets NODE_ENV and the docs accent is a cosmetic override, so neither is listed.
const UNLISTED = new Set(['NODE_ENV', 'DOCS_ACCENT']);

describe('.env.example', () => {
  const example = parseEnv(readFileSync('.env.example', 'utf8'));
  const original = process.env;
  const read = new Set<string>();

  beforeAll(() => {
    process.env = new Proxy<NodeJS.ProcessEnv>(
      { ...example },
      {
        get: (target, key: string) => {
          read.add(key);
          return target[key];
        },
      },
    );
    for (const config of APP_CONFIGS) {
      config();
    }
  });

  afterAll(() => {
    process.env = original;
  });

  it('parses cleanly through every config namespace', () => {
    expect(read.size).toBeGreaterThan(0);
  });

  it('lists every variable the configs read and nothing else', () => {
    const expected = [...read].filter((key) => !UNLISTED.has(key)).sort();

    expect(Object.keys(example).sort()).toEqual(expected);
  });
});
