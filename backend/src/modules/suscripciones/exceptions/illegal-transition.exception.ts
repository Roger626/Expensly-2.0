import { ConflictException } from '@nestjs/common';

/**
 * Thrown when a subscription transition is not allowed by the state machine.
 * Error code: SUBSCRIPTION_ILLEGAL_TRANSITION
 */
export class SubscriptionIllegalTransitionException extends ConflictException {
  constructor(from: string, to: string) {
    super({
      statusCode: 409,
      errorCode: 'SUBSCRIPTION_ILLEGAL_TRANSITION',
      message: `SUBSCRIPTION_ILLEGAL_TRANSITION: Transición ilegal de suscripción "${from}" → "${to}" no está permitida`,
    });
  }
}
