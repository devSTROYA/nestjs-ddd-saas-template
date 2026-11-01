import {
  ACCENT_COLORS,
  AccentColor,
  DEFAULT_ACCENT,
  LatteColor,
  MochaColor,
  isAccentColor,
} from './catppuccin.js';
import { COLOR_MODES, DEFAULT_COLOR_MODE, isColorMode } from './color-mode.js';
import { buildDocsThemeCss, buildModeCss } from './docs-theme.js';
import { darkRoles, lightRoles } from './scalar-roles.js';

const HEX = /^#[0-9a-f]{6}$/;
const PALETTE_SIZE = 26;
const ACCENT_COUNT = 14;

describe('Catppuccin palettes', () => {
  it.each([
    ['Mocha', MochaColor],
    ['Latte', LatteColor],
  ])('%s has all 26 colors as 6 digit hex values', (_name, palette) => {
    const values = Object.values(palette);

    expect(values).toHaveLength(PALETTE_SIZE);
    expect(values.every((value) => HEX.test(value))).toBe(true);
  });

  it('defines the same color names in both flavors', () => {
    expect(Object.keys(LatteColor)).toEqual(Object.keys(MochaColor));
  });
});

describe('accent colors', () => {
  it('lists the 14 Catppuccin accents, all of them palette colors', () => {
    expect(ACCENT_COLORS).toHaveLength(ACCENT_COUNT);
    for (const accent of ACCENT_COLORS) {
      expect(Object.keys(MochaColor)).toContain(accent);
    }
  });

  it('accepts accents only, not the text and surface colors', () => {
    expect(isAccentColor('mauve')).toBe(true);
    expect(isAccentColor('surface0')).toBe(false);
    expect(isAccentColor('text')).toBe(false);
    expect(isAccentColor('banana')).toBe(false);
  });

  it('defaults to lavender, the closest accent to the kepler theme', () => {
    expect(DEFAULT_ACCENT).toBe(AccentColor.lavender);
  });
});

describe('role maps', () => {
  it.each([
    ['dark', darkRoles],
    ['light', lightRoles],
  ])('every %s role points to a color that exists in the palette', (_name, roles) => {
    for (const color of Object.values(roles)) {
      expect(Object.keys(MochaColor)).toContain(color);
    }
  });

  it('keeps the page, raised and nested backgrounds distinct in each mode', () => {
    for (const roles of [darkRoles, lightRoles]) {
      expect(new Set([roles.background1, roles.background2, roles.background3]).size).toBe(3);
    }
  });
});

describe('buildDocsThemeCss', () => {
  it('declares the whole Latte palette for light mode and the whole Mocha palette for dark mode', () => {
    const css = buildDocsThemeCss();
    const [light = '', dark = ''] = css.split('\n.dark-mode {').map((part) => part.trim());

    for (const [name, hex] of Object.entries(LatteColor)) {
      expect(light).toContain(`--ctp-${name}: ${hex};`);
    }
    for (const [name, hex] of Object.entries(MochaColor)) {
      expect(dark).toContain(`--ctp-${name}: ${hex};`);
    }
    expect(light).toContain('\n.light-mode {');
  });

  it('points every Scalar color at the palette variables and the accent at one variable', () => {
    const css = buildDocsThemeCss(AccentColor.peach);

    expect(css).toContain('--ctp-accent: var(--ctp-peach);');
    expect(css).toContain('--scalar-color-accent: var(--ctp-accent);');
    expect(css).toContain('--scalar-background-1: var(--ctp-crust);');
    expect(css).toContain('--scalar-background-1: var(--ctp-base);');
    expect(css).toContain('--scalar-color-purple: var(--ctp-mauve);');
    expect(css).toContain(
      '--scalar-background-accent: color-mix(in srgb, var(--ctp-accent) 12%, transparent);',
    );
  });

  it('keeps the request example card on Latte in light mode with an earlier important layer', () => {
    const css = buildDocsThemeCss();

    expect(css.startsWith('@layer ctp-light-card {')).toBe(true);
    expect(css).toContain(
      '.light-mode .dark-mode.scalar-card.scalar-card, .light-mode .dark-mode.scalar-card.scalar-card * {',
    );
    expect(css).toContain(
      `--scalar-background-2: var(--ctp-${lightRoles.background2}) !important;`,
    );
    expect(css).toContain('background-color: var(--scalar-background-2) !important;');
  });

  it('changes only the --ctp-accent lines when the accent changes', () => {
    const baseline = buildDocsThemeCss(AccentColor.lavender).split('\n');

    for (const accent of ACCENT_COLORS) {
      const changed = buildDocsThemeCss(accent)
        .split('\n')
        .filter((line, index) => line !== baseline[index]);

      expect(changed.every((line) => line.startsWith('  --ctp-accent: var(--ctp-'))).toBe(true);
      expect(changed).toHaveLength(accent === AccentColor.lavender ? 0 : 3);
    }
  });

  it('follows a changed palette color and a changed role', () => {
    const recolored = buildModeCss(
      '.x',
      { ...MochaColor, lavender: '#123456' },
      darkRoles,
      AccentColor.lavender,
    );
    const remapped = buildModeCss(
      '.x',
      MochaColor,
      { ...darkRoles, purple: 'pink' },
      AccentColor.lavender,
    );

    expect(recolored).toContain('--ctp-lavender: #123456;');
    expect(remapped).toContain('--scalar-color-purple: var(--ctp-pink);');
  });
});

describe('color modes', () => {
  it('defaults to toggle and only accepts toggle and system', () => {
    expect(DEFAULT_COLOR_MODE).toBe('toggle');
    expect(COLOR_MODES).toEqual(['toggle', 'system']);
    expect(isColorMode('system')).toBe(true);
    expect(isColorMode('dark')).toBe(false);
    expect(isColorMode('')).toBe(false);
  });
});
