/**
 * Interface for payment gateway operations.
 * All methods are asynchronous and return Promises.
 * No method accepts PAN, CVV, or raw card data — PCI-compliant by design.
 */
export interface IPagoService {
  /**
   * Create a payment link hosted by the gateway.
   * Returns a checkout URL and a unique operation code.
   */
  crearEnlacePago(input: EnlacePagoInput): Promise<{ checkoutUrl: string; code: string }>;

  /**
   * Capture a card token and charge the specified amount.
   * The cardToken is a gateway-provided token, not raw card data.
   */
  capturarTarjetaYcobrar(cardToken: string, monto: number): Promise<string>;

  /**
   * Query a transaction by its operation code.
   * Used for server-side polling (no webhook).
   */
  consultarTransaccion(codOper: string): Promise<PfTransaccionResponse>;

  /**
   * Charge a stored card token for recurring billing.
   * Returns the operation code for confirmation polling.
   */
  cobroRecurrente(cardToken: string, monto: number): Promise<string>;

  /**
   * Refund a transaction. If monto is omitted, full amount is refunded.
   */
  reembolsar(codOper: string, monto?: number): Promise<void>;
}

/** Input for creating a payment link (Enlace de Pago — redirect flow). */
export interface EnlacePagoInput {
  /** Amount in USD (CMTN). */
  monto: number;
  /** Purchase description, max 150 chars (CDSC). */
  descripcion: string;
  /** Absolute URL where PF redirects after payment (RETURN_URL, HEX-encoded by service). */
  returnUrl: string;
  /** Custom parameter returned as-is by PF (PARM_1). Used to round-trip plan name. */
  parm1?: string;
}

/** Response shape from Paguelo Fácil transaction query. */
export interface PfTransaccionResponse {
  status: number;
  codOper: string;
  monto: number;
  cardToken?: string;
  displayNum?: string;
  raw?: unknown;
}
