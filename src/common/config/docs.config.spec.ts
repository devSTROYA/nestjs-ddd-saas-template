import { docsConfig } from './docs.config.js';

describe('docsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies defaults', () => {
    vi.stubEnv('DOCS_ACCENT', undefined);
    vi.stubEnv('DOCS_COLOR_MODE', undefined);

    expect(docsConfig()).toEqual({ accent: 'lavender', colorMode: 'toggle' });
  });

  it('accepts a Catppuccin accent, treats empty as the default and rejects others', () => {
    vi.stubEnv('DOCS_ACCENT', 'mauve');
    expect(docsConfig().accent).toBe('mauve');

    vi.stubEnv('DOCS_ACCENT', '');
    expect(docsConfig().accent).toBe('lavender');

    vi.stubEnv('DOCS_ACCENT', 'banana');
    expect(() => docsConfig()).toThrow(/DOCS_ACCENT/);

    vi.stubEnv('DOCS_ACCENT', 'surface0');
    expect(() => docsConfig()).toThrow(/DOCS_ACCENT/);
  });

  it('accepts a color mode, treats empty as toggle and rejects others', () => {
    vi.stubEnv('DOCS_COLOR_MODE', 'system');
    expect(docsConfig().colorMode).toBe('system');

    vi.stubEnv('DOCS_COLOR_MODE', 'toggle');
    expect(docsConfig().colorMode).toBe('toggle');

    vi.stubEnv('DOCS_COLOR_MODE', '');
    expect(docsConfig().colorMode).toBe('toggle');

    vi.stubEnv('DOCS_COLOR_MODE', 'dark');
    expect(() => docsConfig()).toThrow(/DOCS_COLOR_MODE/);
  });
});
