// HTML real capturado del portal DGI Panamá (Consultas/FacturasPorQR) para una
// factura electrónica real, usado como fixture de regresión. El campo hidden
// "facturaXML" (varios KB de base64 con el XML firmado del CAFE) se recorta
// porque no aporta nada al parsing y solo infla el archivo de test.
export const REAL_DGI_FACTURA_HTML = `
<!DOCTYPE html>
<html lang="es-pa">
<head><title>Consultar Facturas Por QR</title></head>
<body>
  <div class="container-fluid">
    <div class="row">
      <div class="col-md-12">
        <h1>Consultar Facturas Por QR</h1>
        <div class="row" id="facturashow">
          <div>
            <div class="row">
              <div class="col-sm-12">
                <div class="panel panel-default">
                  <div class="panel-heading">
                    <div class="row">
                      <div class="col-sm-4 text-left"><h5>No. 0002894016</h5></div>
                      <div class="col-sm-4 text-center"><h4><strong>FACTURA</strong></h4></div>
                      <div class="col-sm-4 text-right"><h5>25/02/2026 00:00:00</h5></div>
                    </div>
                  </div>
                  <div class="panel-body">
                    <div class="row">
                      <div class="col-sm-2"></div>
                      <div class="col-sm-10">
                        <div class="row">
                          <div class="col-sm-8">
                            <dl class="dl-vertical">
                              <dt class="small">CÓDIGO ÚNICO DE FACTURA ELECTRÓNICA [CUFE]</dt>
                              <dd style="word-wrap: break-word;">FE01200001080323-1-554308-39PPAL2026022500028940160200114825972210</dd>
                            </dl>
                          </div>
                          <div class="col-sm-4">
                            <dl class="dl-vertical">
                              <dt class="small">PROTOCOLO DE AUTORIZACIÓN</dt>
                              <dd>20260000000292893723</dd>
                            </dl>
                          </div>
                        </div>
                        <div class="row">
                          <div class="col-sm-8">
                            <dl class="dl-vertical">
                              <dt class="small">MODALIDAD EMISIÓN</dt>
                              <dd>Autorización de Uso Previa, Operación normal</dd>
                            </dl>
                          </div>
                          <div class="col-sm-4">
                            <dl class="dl-vertical">
                              <dt class="small">FECHA AUTORIZACIÓN</dt>
                              <dd>25/02/2026 08:55:13</dd>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-sm-6">
                <div class="panel panel-default">
                  <div class="panel-heading">EMISOR</div>
                  <div class="panel-body">
                    <div class="row">
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">RUC</dt><dd>1080323-1-554308</dd></dl></div>
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">DV</dt><dd>39</dd></dl></div>
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">NOMBRE</dt><dd>EMPRESAS CARBONE S A</dd></dl></div>
                    </div>
                    <div class="row">
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">DIRECCIÓN</dt><dd>RIO ABAJO, CALLE 5TA, EDIF. CARBONE</dd></dl></div>
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">TELÉFONO</dt><dd>391-6309</dd></dl></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-sm-6">
                <div class="panel panel-default">
                  <div class="panel-heading">
                    <div class="row">
                      <div class="col-sm-4">RECEPTOR</div>
                      <div class="col-sm-4"><kbd>CONSUMIDOR FINAL</kbd></div>
                    </div>
                  </div>
                  <div class="panel-body">
                    <div class="row">
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">CÉDULA DE IDENTIDAD</dt><dd></dd></dl></div>
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">DV</dt><dd></dd></dl></div>
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">NOMBRE</dt><dd>ROGER MILLAN</dd></dl></div>
                    </div>
                    <div class="row">
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">DIRECCIÓN</dt><dd>RESIDENCIALES LAS LOMAS CALLE ENSUEÑO CASA BARRIO COLON LA CHORRERACASA .LA CHO</dd></dl></div>
                      <div class="col-sm-6"><dl class="dl-vertical"><dt class="small">TELÉFONO</dt><dd></dd></dl></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-sm-12">
                <div class="panel panel-default">
                  <div class="panel-heading">
                    <div data-toggle="collapse" data-target="#detalle">Detalle <span class="glyphicon glyphicon-th-list"></span></div>
                  </div>
                  <div class="panel-body collapse in" id="detalle">
                    <table class="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Linea</th><th>Código</th><th>Descripción</th><th>Información de interés</th>
                          <th>Cantidad</th><th>Precio Unitario</th><th>Descuento Unitario</th>
                          <th>Monto</th><th>ITBMS</th><th>ISC</th><th>Acarreo</th><th>Seguro</th><th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td data-title="Linea" class="text-center">1</td>
                          <td data-title="Código" class="text-center">UN-P100</td>
                          <td data-title="Descripción" class="text-left">Rollo mosquitera negra 1.25x30m malla 18x18 anti-UV PP+PE resistente para ventanas y puertas</td>
                          <td data-title="Información de interés" class="text-left"></td>
                          <td data-title="Cantidad" class="text-center">1.000000</td>
                          <td data-title="Precio" class="text-right">12.490000</td>
                          <td data-title="Descuento" class="text-right">0.00</td>
                          <td data-title="Monto" class="text-right">12.490000</td>
                          <td data-title="Impuesto" class="text-right">0.874300</td>
                          <td data-title="ISC" class="text-right">0.00</td>
                          <td data-title="Acarreo" class="text-right"></td>
                          <td data-title="Seguro" class="text-right"></td>
                          <td data-title="Total" class="text-right">13.364300</td>
                        </tr>
                        <tr>
                          <td data-title="Linea" class="text-center">2</td>
                          <td data-title="Código" class="text-center">P8J09</td>
                          <td data-title="Descripción" class="text-left">Silla de Oficina Ergonomica con Soporte 3D y Reclinación. Cómoda silla de computadora, Color gris para escritorio.</td>
                          <td data-title="Información de interés" class="text-left"></td>
                          <td data-title="Cantidad" class="text-center">1.000000</td>
                          <td data-title="Precio" class="text-right">107.000000</td>
                          <td data-title="Descuento" class="text-right">0.00</td>
                          <td data-title="Monto" class="text-right">107.000000</td>
                          <td data-title="Impuesto" class="text-right">7.490000</td>
                          <td data-title="ISC" class="text-right">0.00</td>
                          <td data-title="Acarreo" class="text-right"></td>
                          <td data-title="Seguro" class="text-right"></td>
                          <td data-title="Total" class="text-right">114.490000</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr><td class="text-right" colspan="12">Descuentos: <div style="width: 100px;display: inline-block;">0.00</div></td></tr>
                        <tr><td class="text-right" colspan="12">Valor Total: <div style="width: 100px;display: inline-block;">127.85</div></td></tr>
                        <tr><td class="text-right" colspan="12">ITBMS Total: <div style="width: 100px;display: inline-block;">8.36</div></td></tr>
                        <tr><td class="text-right" colspan="12"><kbd>Forma de Pago</kbd><div style="width: 100px;display: inline-block;"></div></td></tr>
                        <tr><td class="text-right" colspan="12">Efectivo: <div style="width: 100px;display: inline-block;">127.85</div></td></tr>
                        <tr><td class="text-right" colspan="12">TOTAL PAGADO: <div style="width: 100px;display: inline-block;">127.85</div></td></tr>
                        <tr><td class="text-right" colspan="12">Vuelto: <div style="width: 100px;display: inline-block;">0.00</div></td></tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-sm-12">
                <div class="panel panel-default">
                  <div class="panel-heading">INFORMACION COMERCIAL GENERAL</div>
                  <div class="panel-body">
                    <div class="row">
                      <div class="col-sm-2"><dl class="dl-vertical"><dt class="small">No. Pedido o Referencia</dt><dd>256094</dd></dl></div>
                      <div class="col-sm-8"><dl class="dl-vertical"><dt class="small">Información del Pedido</dt><dd>No. de pedido - 256094</dd></dl></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <form action="/Consultas/DescargarFacturaPDF" id="fImprimir" method="post" target="ifImprimir">
              <input id="facturaXML" name="facturaXML" type="hidden" value="TRIMMED_BASE64_XML_SIGNED_CAFE" />
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
