import type { CatppuccinColor } from './catppuccin.js';

export interface ScalarRoles {
  text1: CatppuccinColor;
  text2: CatppuccinColor;
  text3: CatppuccinColor;
  background1: CatppuccinColor;
  background2: CatppuccinColor;
  background3: CatppuccinColor;
  border: CatppuccinColor;
  green: CatppuccinColor;
  red: CatppuccinColor;
  yellow: CatppuccinColor;
  blue: CatppuccinColor;
  orange: CatppuccinColor;
  purple: CatppuccinColor;
  query: CatppuccinColor;
  button: CatppuccinColor;
  buttonText: CatppuccinColor;
}

export const darkRoles: ScalarRoles = {
  text1: 'text',
  text2: 'subtext1',
  text3: 'overlay0',
  background1: 'crust',
  background2: 'mantle',
  background3: 'base',
  border: 'surface0',
  green: 'green',
  red: 'red',
  yellow: 'yellow',
  blue: 'sapphire',
  orange: 'peach',
  purple: 'mauve',
  query: 'teal',
  button: 'text',
  buttonText: 'crust',
};

export const lightRoles: ScalarRoles = {
  text1: 'text',
  text2: 'subtext0',
  text3: 'overlay1',
  background1: 'base',
  background2: 'mantle',
  background3: 'crust',
  border: 'surface0',
  green: 'green',
  red: 'red',
  yellow: 'yellow',
  blue: 'sapphire',
  orange: 'peach',
  purple: 'mauve',
  query: 'teal',
  button: 'text',
  buttonText: 'base',
};
