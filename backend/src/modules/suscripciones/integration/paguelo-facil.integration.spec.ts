/**
 * Integration test skeleton for Paguelo Fácil sandbox.
 *
 * Uses test card 4059310181757001.
 * Skipped by default — run with: RUN_INTEGRATION=1 npm test
 *
 * Full execution deferred to Slice 4 manual verification.
 * This file establishes the convention (reviewer fix #3).
 */

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1';

(RUN_INTEGRATION ? describe : describe.skip)('Paguelo Fácil integration (sandbox)', () => {
  it.todo('should query a transaction by codOper against the real sandbox');

  it.todo('should reject a duplicate codOper (idempotency)');
});
