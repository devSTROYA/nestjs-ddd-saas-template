import { Module } from '@nestjs/common';

import { DatabaseModule } from '@common/database';

import { HealthController } from './health.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
