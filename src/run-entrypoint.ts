import { Logger } from '@nestjs/common';

const EXIT_CODE = 1;

// INFO: Config errors are reported and exited by checkConfigOrExit; anything else is logged once here.
export async function runEntrypoint(name: string, main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    const logger = new Logger(name);
    if (error instanceof Error) {
      logger.error(error.message, error.stack);
    } else {
      logger.error(String(error));
    }
    process.exit(EXIT_CODE);
  }
}
