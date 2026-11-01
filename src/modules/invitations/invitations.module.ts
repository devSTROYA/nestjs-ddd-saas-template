import { Module } from '@nestjs/common';

import { ClockModule } from '@common/clock';
import { DATABASE_CONTEXT, DatabaseModule, type DatabaseContext } from '@common/database';
import { MAIL_TRANSPORT, MailModule, type MailTransport } from '@common/mail';
import { OtpModule } from '@common/otp';

import { TenantsModule } from '../tenants/tenants.module.js';
import { UsersModule } from '../users/users.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { INVITATION_REPOSITORY } from './application/ports/invitation.repository.js';
import { MAILER } from './application/ports/mailer.js';
import { AcceptInvitationHandler } from './application/use-cases/accept-invitation/accept-invitation.handler.js';
import { InviteTenantHandler } from './application/use-cases/invite-tenant/invite-tenant.handler.js';
import { EmailMailer } from './infrastructure/mail/email-mailer.js';
import { DrizzleInvitationRepository } from './infrastructure/persistence/drizzle-invitation.repository.js';
import { InvitationsController } from './presentation/invitations.controller.js';

@Module({
  imports: [
    DatabaseModule,
    ClockModule,
    MailModule,
    OtpModule,
    TenantsModule,
    UsersModule,
    WorkspacesModule,
  ],
  controllers: [InvitationsController],
  providers: [
    {
      provide: INVITATION_REPOSITORY,
      inject: [DATABASE_CONTEXT],
      useFactory: (context: DatabaseContext): DrizzleInvitationRepository =>
        new DrizzleInvitationRepository(context),
    },
    {
      provide: MAILER,
      inject: [MAIL_TRANSPORT],
      useFactory: (transport: MailTransport): EmailMailer => new EmailMailer(transport),
    },
    InviteTenantHandler,
    AcceptInvitationHandler,
  ],
  exports: [INVITATION_REPOSITORY],
})
export class InvitationsModule {}
