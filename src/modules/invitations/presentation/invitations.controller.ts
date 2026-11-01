import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { Throttle } from '@common/rate-limit';
import { ZodValidationPipe } from '@common/validation';
import {
  CurrentPrincipal,
  type Principal,
  PrincipalType,
  Public,
  RequirePrincipal,
} from '@modules/auth';

import {
  AcceptInvitationCommand,
  type AcceptInvitationResult,
} from '../application/use-cases/accept-invitation/accept-invitation.command.js';
import { InviteTenantCommand } from '../application/use-cases/invite-tenant/invite-tenant.command.js';
import { InvitationId } from '../domain/value-objects/invitation-id.js';
import { ACCEPT_PER_IP } from './invitation.rate-limits.js';
import {
  type AcceptInvitationBody,
  acceptInvitationBodySchema,
} from './accept-invitation.schema.js';
import {
  type InviteTenantBody,
  type InviteTenantResponse,
  inviteTenantBodySchema,
} from './invite-tenant.schema.js';

@Controller('invitations')
export class InvitationsController {
  constructor(@Inject(CommandBus) private readonly commandBus: CommandBus) {}

  @Post()
  @RequirePrincipal(PrincipalType.ADMIN)
  async invite(
    @CurrentPrincipal() principal: Principal,
    @Body(new ZodValidationPipe(inviteTenantBodySchema)) body: InviteTenantBody,
  ): Promise<InviteTenantResponse> {
    const invitationId = await this.commandBus.execute<InviteTenantCommand, InvitationId>(
      new InviteTenantCommand(principal.id, body.email),
    );
    return { invitationId: invitationId.value };
  }

  @Public()
  @Throttle(ACCEPT_PER_IP)
  @Post(':id/accept')
  accept(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(acceptInvitationBodySchema)) body: AcceptInvitationBody,
  ): Promise<AcceptInvitationResult> {
    return this.commandBus.execute<AcceptInvitationCommand, AcceptInvitationResult>(
      new AcceptInvitationCommand(id, body.otp, body.tenantName, body.userName),
    );
  }
}
