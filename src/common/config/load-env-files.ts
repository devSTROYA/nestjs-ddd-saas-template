import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { envFilePaths } from './env-files.js';

export function loadEnvFiles(files: readonly string[] = envFilePaths()): void {
  for (const file of files) {
    if (!existsSync(file)) {
      continue;
    }
    for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
      process.env[key] ??= value;
    }
  }
}
