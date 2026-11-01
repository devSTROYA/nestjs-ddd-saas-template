import { registerAs } from '@nestjs/config';
import { z } from 'zod';

import {
  ACCENT_COLORS,
  type AccentColor,
  COLOR_MODES,
  type ColorMode,
  DEFAULT_ACCENT,
  DEFAULT_COLOR_MODE,
  isAccentColor,
  isColorMode,
} from '../docs-theme/index.js';
import { emptyToUndefined, parseConfig } from './parse-config.js';

const docsSchema = z.object({
  DOCS_ACCENT: z.preprocess(
    emptyToUndefined,
    z
      .custom<AccentColor>((value) => typeof value === 'string' && isAccentColor(value), {
        message: `must be one of: ${ACCENT_COLORS.join(', ')}`,
      })
      .default(DEFAULT_ACCENT),
  ),
  DOCS_COLOR_MODE: z.preprocess(
    emptyToUndefined,
    z
      .custom<ColorMode>((value) => typeof value === 'string' && isColorMode(value), {
        message: `must be one of: ${COLOR_MODES.join(', ')}`,
      })
      .default(DEFAULT_COLOR_MODE),
  ),
});

export const docsConfig = registerAs('docs', () => {
  const env = parseConfig('docs', docsSchema);
  return { accent: env.DOCS_ACCENT, colorMode: env.DOCS_COLOR_MODE };
});
