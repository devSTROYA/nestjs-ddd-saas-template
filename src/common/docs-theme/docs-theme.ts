import {
  type AccentColor,
  type CatppuccinPalette,
  DEFAULT_ACCENT,
  LatteColor,
  MochaColor,
} from './catppuccin.js';
import { type ScalarRoles, darkRoles, lightRoles } from './scalar-roles.js';

const ACCENT_BACKGROUND_PERCENT = 12;
const BUTTON_HOVER_PERCENT = 90;

const LIGHT_CARD = '.light-mode .dark-mode.scalar-card.scalar-card';
const LIGHT_CARD_LAYER = 'ctp-light-card';
const LIGHT_CARD_SELECTOR = `${LIGHT_CARD}, ${LIGHT_CARD} *`;

const token = (color: string): string => `var(--ctp-${color})`;

export function buildModeCss(
  selector: string,
  palette: CatppuccinPalette,
  roles: ScalarRoles,
  accent: AccentColor,
  important = false,
): string {
  const suffix = important ? ' !important' : '';
  const paletteVariables = Object.entries(palette).map(([name, hex]): [string, string] => [
    `--ctp-${name}`,
    hex,
  ]);
  const scalarVariables: [string, string][] = [
    ['--ctp-accent', token(accent)],
    ['--scalar-color-1', token(roles.text1)],
    ['--scalar-color-2', token(roles.text2)],
    ['--scalar-color-3', token(roles.text3)],
    ['--scalar-color-accent', token('accent')],
    ['--scalar-background-1', token(roles.background1)],
    ['--scalar-background-2', token(roles.background2)],
    ['--scalar-background-3', token(roles.background3)],
    [
      '--scalar-background-accent',
      `color-mix(in srgb, ${token('accent')} ${ACCENT_BACKGROUND_PERCENT}%, transparent)`,
    ],
    ['--scalar-border-color', token(roles.border)],
    ['--scalar-color-green', token(roles.green)],
    ['--scalar-color-red', token(roles.red)],
    ['--scalar-color-yellow', token(roles.yellow)],
    ['--scalar-color-blue', token(roles.blue)],
    ['--scalar-color-orange', token(roles.orange)],
    ['--scalar-color-purple', token(roles.purple)],
    ['--scalar-color-query', token(roles.query)],
    ['--scalar-button-1', token(roles.button)],
    [
      '--scalar-button-1-hover',
      `color-mix(in srgb, ${token(roles.button)} ${BUTTON_HOVER_PERCENT}%, transparent)`,
    ],
    ['--scalar-button-1-color', token(roles.buttonText)],
  ];
  const body = [...paletteVariables, ...scalarVariables]
    .map(([name, value]) => `  ${name}: ${value}${suffix};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

export function buildDocsThemeCss(accent: AccentColor = DEFAULT_ACCENT): string {
  return [
    // Scalar forces dark colors on the request example card and everything inside it with
    // `!important` rules in its own cascade layers, including a literal background on the card.
    // For important declarations the earliest layer wins, so these live in a layer declared
    // before Scalar's.
    `@layer ${LIGHT_CARD_LAYER} {\n${buildModeCss(LIGHT_CARD_SELECTOR, LatteColor, lightRoles, accent, true)}\n${LIGHT_CARD} {\n  background-color: var(--scalar-background-2) !important;\n}\n}`,
    buildModeCss('.light-mode', LatteColor, lightRoles, accent),
    buildModeCss('.dark-mode', MochaColor, darkRoles, accent),
  ].join('\n');
}
