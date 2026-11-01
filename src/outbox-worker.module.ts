import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envFilePaths } from '@common/config';
import { OutboxModule } from '@common/outbox';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFilePaths(),
    }),
    OutboxModule,
  ],
})
export class OutboxWorkerModule {}
