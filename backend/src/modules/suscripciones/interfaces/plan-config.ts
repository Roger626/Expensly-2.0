/**
 * Plan configuration interface.
 * Mirrors the proposal §9 pricing model: Basic / Pro / Premium.
 */
export interface PlanConfig {
  name: string;
  price_usd: number;
  features_dummy: string[];
}
