import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { CLOCK, type Clock } from '@common/clock';
import { UNIT_OF_WORK, type UnitOfWork } from '@common/database';
import type { Nullable } from '@common/types';
import { ADMIN_REPOSITORY, type AdminRepository, toAdminId } from '@modules/admins';
import { toTenantId } from '@modules/tenants';
import { USER_REPOSITORY, type UserRepository, toUserId } from '@modules/users';

import { type RefreshToken, RotationOutcome } from '../../../domain/entities/refresh-token.js';
import { InvalidRefreshTokenError } from '../../../domain/errors/domain.error.js';
import { PrincipalType } from '../../../domain/value-objects/principal.js';
import { REFRESH_TOKEN_CODEC, type RefreshTokenCodec } from '../../ports/refresh-token-codec.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../ports/refresh-token.repository.js';
import { type Session, SessionService } from '../../session.service.js';
import { RefreshTokensCommand } from './refresh-tokens.command.js';

@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler implements ICommandHandler<RefreshTokensCommand, Session> {
  constructor(
    @Inject(ADMIN_REPOSITORY) private readonly admins: AdminRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(REFRESH_TOKEN_CODEC) private readonly codec: RefreshTokenCodec,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async execute(command: RefreshTokensCommand): Promise<Session> {
    const tokenHash = this.codec.hash(command.refreshToken);

    const session = await this.unitOfWork.run(() => this.rotate(tokenHash));
    if (!session) {
      throw new InvalidRefreshTokenError();
    }
    return session;
  }

  private async rotate(tokenHash: string): Promise<Nullable<Session>> {
    const token = await this.refreshTokens.findByHashForUpdate(tokenHash);
    if (!token) {
      return null;
    }

    const now = this.clock.now();
    const outcome = token.rotate(now);
    if (outcome === RotationOutcome.REUSED || !(await this.principalExists(token))) {
      await this.refreshTokens.revokeFamily(token.familyId, now);
      return null;
    }
    if (outcome === RotationOutcome.EXPIRED) {
      return null;
    }

    await this.refreshTokens.save(token);
    return this.sessions.issue(token.principal, token.familyId, now);
  }

  private async principalExists(token: RefreshToken): Promise<boolean> {
    const { type, id, tenantId } = token.principal;
    if (type === PrincipalType.ADMIN) {
      return (await this.admins.findById(toAdminId(id))) !== null;
    }
    return (
      tenantId !== undefined &&
      (await this.users.findById(toTenantId(tenantId), toUserId(id))) !== null
    );
  }
}
