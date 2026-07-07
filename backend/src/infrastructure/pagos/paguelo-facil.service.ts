import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException, RequestTimeoutException, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { IPagoService, EnlacePagoInput, PfTransaccionResponse } from './pagos.interface';

@Injectable()
export class PagueloFacilService implements IPagoService {
  /** Internal base URL for the PF Management API (design §3). */
  private readonly baseUrl: string;

  /** LinkDeamon endpoint for Enlace de Pago (redirect flow). */
  private readonly linkDeamonUrl: string;

  /** Public for test inspection. @private */
  readonly cclw: string;

  /** Public for test inspection. @private */
  readonly accessToken: string;

  constructor() {
    this.cclw = process.env.PAGUELO_CCLW ?? '';
    this.accessToken = process.env.PAGUELO_ACCESS_TOKEN ?? '';
    const env = (process.env.PAGUELO_ENV ?? 'sandbox') as string;
    this.baseUrl =
      env === 'prod'
        ? 'https://admin.paguelofacil.com'
        : 'https://sandbox.paguelofacil.com';

    // LinkDeamon.cfm uses secure.paguelofacil.com for prod, sandbox.paguelofacil.com for sandbox
    this.linkDeamonUrl =
      env === 'prod'
        ? 'https://secure.paguelofacil.com/LinkDeamon.cfm'
        : 'https://sandbox.paguelofacil.com/LinkDeamon.cfm';
  }

  // ── Consultar transacción (real — slice 3) ───────────────────────────────

  async consultarTransaccion(codOper: string): Promise<PfTransaccionResponse> {
    const url = `${this.baseUrl}/PFManagementServices/api/v1/MerchantTransactions?filter=codOper::${encodeURIComponent(codOper)}`;

    let response;
    try {
      response = await axios.get(url, {
        headers: {
          // PF management API expects the raw accessToken (PUBLIC_KEY|PRIVATE_KEY)
          // WITHOUT a "Bearer" prefix — verified against sandbox 2026-07-06.
          Authorization: this.accessToken,
        },
      });
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { headerStatus?: { code?: number } } }; message?: string };
      if (axiosError.response?.data?.headerStatus?.code) {
        return this.handlePfErrorCode(axiosError.response.data.headerStatus.code);
      }
      throw new InternalServerErrorException(
        `Paguelo Fácil request failed: ${axiosError.message ?? 'Unknown error'}`,
      );
    }

    const { headerStatus, data } = response.data ?? {};

    // Check PF header status code
    if (headerStatus?.code && headerStatus.code !== 200) {
      return this.handlePfErrorCode(headerStatus.code);
    }

    // Parse the transaction data — PF returns data as an ARRAY of transactions.
    // Verified against sandbox 2026-07-06: data: [{ amount, status, codOper, displayCardNum, ... }]
    const txData = Array.isArray(data) ? (data[0] ?? {}) : (data ?? {});
    return {
      status: txData.status ?? 0,
      codOper: txData.codOper ?? codOper,
      monto: txData.amount != null ? parseFloat(txData.amount) : 0,
      cardToken: txData.cardToken ?? undefined,
      displayNum: txData.displayCardNum ?? undefined,
      raw: response.data,
    };
  }

  /**
   * Map PF header status codes to Nest HTTP exceptions (design §3 error mapping).
   * Unmapped codes (reviewer fix #5) fall through to InternalServerErrorException.
   */
  private handlePfErrorCode(code: number): never {
    switch (code) {
      case 200:
        // Should not reach here — handled before this call
        throw new InternalServerErrorException('Unexpected PF code 200 in error handler');
      case 400:
        throw new BadRequestException('Invalid request');
      case 410:
        throw new UnauthorizedException('Invalid Api Key');
      case 530:
        throw new ForbiddenException('No privileges');
      case 900:
        throw new RequestTimeoutException('URL TimeOut Connection');
      case 920:
        throw new InternalServerErrorException('Exception');
      default:
        // Reviewer fix #5: unmapped codes → InternalServerErrorException
        throw new InternalServerErrorException(`Paguelo Fácil error: ${code}`);
    }
  }

  // ── Crear enlace de pago (real — slice 4 refactor) ───────────────────────

  async crearEnlacePago(input: EnlacePagoInput): Promise<{ checkoutUrl: string; code: string }> {
    // HEX-encode the RETURN_URL as required by PF
    const hexReturnUrl = Buffer.from(input.returnUrl, 'utf-8').toString('hex').toUpperCase();

    // Build form-urlencoded body
    const params = new URLSearchParams();
    params.append('CCLW', this.cclw);
    params.append('CMTN', input.monto.toString());
    params.append('CDSC', input.descripcion);
    params.append('RETURN_URL', hexReturnUrl);
    params.append('EXPIRES_IN', '3600');
    if (input.parm1) {
      params.append('PARM_1', input.parm1);
    }

    let response;
    try {
      response = await axios.post(this.linkDeamonUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: '*/*',
        },
      });
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { headerStatus?: { code?: number } } }; message?: string };
      if (axiosError.response?.data?.headerStatus?.code) {
        return this.handlePfErrorCode(axiosError.response.data.headerStatus.code);
      }
      throw new InternalServerErrorException(
        `Paguelo Fácil request failed: ${axiosError.message ?? 'Unknown error'}`,
      );
    }

    const { headerStatus, data } = response.data ?? {};

    // Check PF header status code
    if (headerStatus?.code && headerStatus.code !== 200) {
      return this.handlePfErrorCode(headerStatus.code);
    }

    // Parse the response data — reject empty/missing url
    const checkoutUrl = data?.url;
    const code = data?.code;
    if (!checkoutUrl || !code) {
      throw new InternalServerErrorException(
        'Paguelo Fácil response missing checkout URL',
      );
    }

    return { checkoutUrl, code };
  }

  // ── Stub implementations (slice 1 — throw only) ─────────────────────────

  async capturarTarjetaYcobrar(_cardToken: string, _monto: number): Promise<string> {
    throw new Error('not implemented in slice 1');
  }

  async cobroRecurrente(_cardToken: string, _monto: number): Promise<string> {
    throw new Error('not implemented in slice 1');
  }

  async reembolsar(_codOper: string, _monto?: number): Promise<void> {
    throw new Error('not implemented in slice 1');
  }
}
