export const ColorMode = {
  toggle: 'toggle',
  system: 'system',
} as const;

export type ColorMode = (typeof ColorMode)[keyof typeof ColorMode];

export const COLOR_MODES = Object.values(ColorMode);

export const DEFAULT_COLOR_MODE: ColorMode = ColorMode.toggle;

export function isColorMode(value: string): value is ColorMode {
  return (COLOR_MODES as readonly string[]).includes(value);
}
