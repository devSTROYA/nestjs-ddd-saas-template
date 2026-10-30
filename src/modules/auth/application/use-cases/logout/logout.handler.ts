import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';

import { REFRESH_TOKEN_CODEC, type RefreshTokenCodec } from '../../ports/refresh-token-codec.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../ports/refresh-token.repository.js';
import { LogoutCommand } from './logout.command.js';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand, void> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(REFRESH_TOKEN_CODEC) private readonly codec: RefreshTokenCodec,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: LogoutCommand): Promise<void> {
    return this.unitOfWork.run(async () => {
      const token = await this.refreshTokens.findByHashForUpdate(
        this.codec.hash(command.refreshToken),
      );
      if (token) {
        await this.refreshTokens.revokeFamily(token.familyId, this.clock.now());
      }
    });
  }
}
