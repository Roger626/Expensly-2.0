PagueloFacil App

Una integración pensada para ser implementada del lado del cliente,  a través de nuestro SDK podrás invocar un servicio  JS para el procesamiento de transacciones  con todos nuestros métodos de pago con usuario autenticado en nuestro sistema. Con este método, mantendrá siempre al usuario dentro de su sitio y controlará todas las respuestas en pantalla.

Prerrequisitos
CCLW
Llaves de conexión al API
Certificado SSL
TLS 1.3 o superior
Base URL de ambientes
Producción
https://secure.paguelofacil.com/
https://api.pfserver.net/
Pruebas
https://sandbox.paguelofacil.com/
https://api-sand.pfserver.net/
IMPORTANTE — PagueloFacil tiene credenciales para ambiente de pruebas y credenciales para ambiente de producción que permiten integrar los métodos de pago, no se deben confundir al momento de realizar las configuraciones, cada ambiente requiere de sus credenciales. El monto mímo es de $ 1.00 y la moneda permitida es USD.
1. Incluye el script en tu sitio
Debes incluir los scripts para poder utilizar clave dentro de tu sitio web.

Copy to clipboard

<head >
...
<script src="https://secure.paguelofacil.com/HostedFields/vendor/scripts/WALLET/PFScript.js"></script>
...
<head >
2. Agrega el HTML en tu sitio
Debes agregar un identificador id el elemento del HTML que contendrá el SDK.

Copy to clipboard

    <body>
        <div align="center">
            <div id="container-form" style="width: 45%;"></div>
        </div>

    </body>
3. Incluye SDK y configuralo en tu sitio
Debes personalizar la cofiguración del SDK y obtener la respuesta del procesamiento de la transacción dentro de tu sitio web.

Copy to clipboard

        <script>
          const getUrlParam = (key) => new URLSearchParams(window.location.search).get(key);

            pfWallet = pfWallet || {};
            let apiKey = "";
            let cclw = "";
            
            apiKey = "E2f0JaAPu3aN6UYB"; // AccessTokenApi que encuentras en Mi Empresas-> Llaves
            cclw = "15224BE0CBB8EAAC33B53850FF71EAE732253AFCB"; //Código Web
            pfWallet.useAsSandbox(true);
                    
            pfWallet.openService({
                apiKey: apiKey,
                cclw: cclw
            }).then(function (merchantSetup) {
                startMerchantForm(merchantSetup);
            }, function (error) {
                console.log(error);
            });

            let sdk;
            function startMerchantForm(merchantSetup) {
                let paymentInfo = {
                    amount: parseFloat(getUrlParam('monto')),
                    discount: 0.0,
                    taxAmount: 0.0,
                    description: getUrlParam('descripcion')
                };
                console.log("merchantSetup", merchantSetup);
                let setup = {
                    lang: 'es',
                    embedded: (getUrlParam('boton') == "false"),
                    // type: 'lk',
                    // code: 'LK-MAIMLMD1FKSQKCHU',
                    container: 'container-form',
                    onError: function (data) {
                        console.error("errors", data);
                    },
                    onTxSuccess: function (data) {
                        console.log("onTxSuccess", data);
                        window.location.href = pfWallet.pfHostViews + `/pf/default-receipt/${data?.Oper}`;
                    },
                    onTxError: function (data) {
                        console.error("when the onTxError, in other process", data);
                    },
                    onClose: function () {
                        console.log("onClose called");
                    }
                };
                sdk = merchantSetup.init(
                    merchantSetup.dataMerchant,
                    paymentInfo,
                    setup
                );
            }

        </script>
Tarjetas de Pruebas
Con estos números de Tarjetas Visa y Mastercard, podrás realizar transacciones aprobadas en cualquiera de nuestros servicios. En cuanto a las fechas de vencimiento te funcionan cualquier mes y año mayor o igual a la fecha actual y para el código de seguridad (CVV2, CVC2) cualquiera tres digitos númericos.


4059310181757001
4916012776136988
4716040174085053
4143766247546688
4929019201087046


5517747952039692
5451819737278230
5161216979741515
5372362326060103
5527316088871226


5038460000000019
CVV: 475
Fecha: 04-21
PIN: 1234
Transacción Aprobada

 
6279561001012467
CVV: 618
Fecha: 12-14
PIN: 6529
Transacción Aprobada

 
5046950000118241
CVV: 098
Fecha: 12-20
PIN: 6806
Transacción Aprobada


5046950000118241
CVV: 098
Fecha: 20-12
PIN: 6806
Transacción Declinada

 
6013770095374264
CVV: N/A
Fecha: N/A
PIN: N/A
Transacción Declinada
(Banco no afiliado a eCommerce)