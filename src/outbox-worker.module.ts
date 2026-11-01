import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envFilePaths, validateEnv } from '@common/config';
import { OutboxModule } from '@common/outbox';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFilePaths(),
      validate: validateEnv,
    }),
    OutboxModule,
  ],
})
export class OutboxWorkerModule {}
