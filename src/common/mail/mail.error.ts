import { HttpStatus } from '@nestjs/common';

import { DomainError } from '../errors/domain-error.js';

export const MailErrorCodes = {
  DELIVERY_FAILED: 'MAIL_DELIVERY_FAILED',
} as const;

export type MailErrorCode = (typeof MailErrorCodes)[keyof typeof MailErrorCodes];

export class MailDeliveryError extends DomainError {
  constructor(reason: string) {
    super(MailErrorCodes.DELIVERY_FAILED, `Email could not be delivered: ${reason}`);
  }
}

export const mailErrorStatus = {
  [MailErrorCodes.DELIVERY_FAILED]: HttpStatus.BAD_GATEWAY,
} as const satisfies Record<MailErrorCode, number>;
