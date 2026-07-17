export interface ProcessInvoice {
  /**
   * Recibe uno o más buffers (páginas/cortes de la misma factura) y devuelve
   * el texto plano extraído de cada imagen (mismo orden, un string por buffer).
   * No hace ningún parsing/entendimiento de campos — eso lo hace ILlmService.
   */
  extractText(fileBuffers: Buffer[]): Promise<string[]>;
}
