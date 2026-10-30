const DEFAULT_NODE_ENV = 'development';

export function envFilePaths(nodeEnv: string = process.env.NODE_ENV ?? DEFAULT_NODE_ENV): string[] {
  return [`.env.${nodeEnv}.local`, '.env'];
}
