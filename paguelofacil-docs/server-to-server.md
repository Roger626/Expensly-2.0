Server-to-Server Integration
Esta guía documenta el flujo de pago servidor a servidor de principio a fin. Está orientada a equipos técnicos que integran y operan el cobro en sus plataformas, manteniendo control total sobre la captura de datos de tarjeta y del pago.

Alcance
Descripción del flujo de autorización y captura.
Intercambio de datos entre el cliente, tu servidor y la pasarela.
Manejo de errores, reintentos y límites de tasa.
Buenas prácticas de seguridad y cumplimiento.
Flujo de alto nivel
Tu frontend recopila los datos del pago de forma segura.
Tu backend valida y normaliza la solicitud.
Tu servidor envía la transacción a la pasarela mediante la API.
Procesas la respuesta (aprobado, rechazado, pendiente) y actualizas tu sistema.
Registras auditoría y notificas al cliente según el resultado.
Servicios de PagueloFacil API

Requisitos previos
Credenciales de API activas y entornos configurados (sandbox/producción).
Canal HTTPS con TLS vigente y verificación de certificados.
Almacenamiento y transmisión de datos sensibles conforme a PCI DSS (evita persistir PAN/CVV salvo que tu alcance de cumplimiento lo permita).
Responsabilidades del integrador
Validación de datos en cliente y servidor (longitud, Luhn, formatos).
Gestión de errores y reintentos con backoff exponencial respetando rate limits.
Registro de eventos para trazabilidad y conciliación.
 

Siguientes pasos
Autenticación: obtén y protege tus credenciales y tokens.
Crea un pago: envía la solicitud de autorización/captura.
Webhooks: configura notificaciones para cambios de estado.
Pruebas: valida con datos de sandbox y casos de borde.
Casos de usos
Seleccione su flujo de pago. Tenga en cuenta que algunos eCommerce podrían no ser compatibles con el flujo de pago elegido. Verifique la compatibilidad.

Pago Asíncrono
El comerciante recopila los datos de la tarjeta del comprador e inicia el flujo de pago asíncrono.

Pre-Autorización
Sale
Pre-Autorización con 3DS

El flujo de pago asíncrono con 3DS permite procesar transacciones donde la confirmación del pago no se produce de inmediato, sino tras una validación adicional del tarjetahabiente.

🔒 Pre-Autorización con 3DS (TX: AUTH)
El comercio envía la solicitud de pre-autorización bloqueando los fondos en la cuenta del cliente.
Se deben incluir atributos como isForm, resultType y returnUrlString.
➡️ Redirección al comprador
El cliente es redirigido a un entorno de validación (3DS, challenge o autenticación reforzada), donde confirma la transacción con su banco emisor.
📡 Obtención del estado
Tras la validación, el comercio debe consultar el estado del pago por:
🔔 Webhook: el sistema de pagos notifica automáticamente las transacciones aprobadas en tu endpoint configurado.
🔄 returnUrlString: tras la redirección del cliente a la URL de retorno, tu sistema debe procesar la respuesta realizando primero una consulta a la API de Transacciones para validar el estado del pago.
💰 Captura del pago (TX: CAPTURE)
Si la pre-autorización fue exitosa, el comercio envía la orden de captura para tomar los fondos.
🛠️ Gestión del pago (Opcional)
Desde el back-office se pueden realizar operaciones adicionales, como reembolsos parciales o totales sobre un sale, un recurrente o una captura.
Pre-Authorizacion con 3DS
Pre-Autorización

En este flujo, primero se realiza una pre-autorización para bloquear fondos y, tras una revisión opcional del comercio, se envía la captura del pago.

🔒 Pre-Autorización (TX: AUTH)
Bloquea los fondos en la cuenta del cliente.
🧐 Revisión del pago (Opcional)
Evaluación interna antes de capturar: disponibilidad de inventario, validación de riesgo/fraude, verificación de envío u otras reglas del comercio.
💰 Capturar el pago (TX: CAPTURE)
Si la pre-autorización es válida, envía la solicitud de captura para tomar los fondos.
🛠️ Gestionar el pago (Opcional)
Operaciones de back-office como reembolsos parciales o totales sobre un sale, un recurrente o una captura.
Authorizacion
Pago Síncrono
EndPoints
Prerrequisitos
ACCESS TOKEN
Token de acceso del usuario
Certificado SSL
TLS 1.3 o superior
Cumplimiento de PCI-DSS
PCI-DSS Compliance: Para recopilar datos de tarjetas, debe cumplir con PCI-DSS. Para minimizar sus requisitos de cumplimiento, utilice Enlace de Pago.
Base URL de ambientes
Producción
https://secure.paguelofacil.com/
https://api.pfserver.net/
Pruebas
https://sandbox.paguelofacil.com/
https://api-sand.pfserver.net/
URL enpoints
Servicio POST
/rest/processTx/{TRANSACCION_TYPE}
Authentication & authorization flows
La integración server-to-server utiliza autenticación por encabezado authorization con el formato PUBLIC_KEY|PRIVATE_KEY. Todas las solicitudes deben enviarse por HTTPS y con el encabezado Content-Type: application/json.

Ejemplo de llamada
 

curl -X POST "https://secure.paguelofacil.com/rest/processTx/AUTH" \
  -H "Content-Type: application/json" \
  -H "authorization: <PUBLIC_KEY>|<PRIVATE_KEY>" \
  -d '{ "cclw":"<token>", "amount": 10.00, "cardInformation": { ... } }'
 

 

 

 

IMPORTANTE — PagueloFacil tiene credenciales para ambiente de pruebas y credenciales para ambiente de producción que permiten integrar los métodos de pago, no se deben confundir al momento de realizar las configuraciones, cada ambiente requiere de sus credenciales. El monto mímo es de $ 1.00 y la moneda permitida es USD.
 

 

 

Pre-Authorización
Reverso
Captura
Sale
Tokenización
Reembolso
Webhooks
Consulta un Pago
URL endpoints
Servicio POST
/rest/processTx/AUTH
Paguelofacil ofrece la posibilidad de realizar una autorización antes de generar una captura. La autorización se puede ver como una reserva de fondos en la tarjeta de tu comprador. Cuando realices una autorización todavía no se le generará un cobro a tu cliente en su tarjeta. Solo cuando se realice una captura el cliente verá el pago.

Ejemplo:
                

 'curl -X POST "https://sandbox.paguelofacil.com/rest/processTx/AUTH" \
  -H "Content-Type: application/json" \
  -H "authorization: WT5hTaUcpa4J3h4AmrZa2EXXJs8boUVa|DIRd852djHbq2j5Fca5VDUkDbExTBCVf" \
  -d '{
    "cclw": "004D3EF3780409D107C59C85664B800FA63FFE09247A7731B8464CCE837F3C2233F973F7308DB9A7069BD460BEC62C6E6054DD1F2DDF7F22067F857FB9E031AA",
    "amount": 3.50,
    "taxAmount": 1.0,
    "email": "alambrito@correo.com",
    "phone": "60201236",
    "address": "testing new address",
    "concept": "Nro-Order-523",
    "description": "Nro-Order-523",
    "cardInformation": {
      "cardNumber": "4916000000000000",
      "expMonth": "12",
      "expYear": "32",
      "cvv": "003",
      "firstName": "alam",
      "lastName": "brito",
      "cardType": "VISA"
    }
  }'
                

        
Parámetros de una solicitud
Parámetro	Tipo	Requerido	Descripción
cclw	
String


Ej.: A7BFCAF7B6……….

Si	Este es el código web que recibe de parte de Paguelofacil y que identifica a su comercio
amount	
 Numeric, Money
 

 

Ej.: 10.00 – 1450.15 – 9.14

Si	El monto o valor total de la transacción a realizar.
NO PONER COMAS (,) o separador de miles.
taxAmount	
 Numeric, Money
 


Ej.: 10.00 – 1450.15 – 9.14

Si	Declaras cuanto de ese monto es ITBMS
NO PONER COMAS (,) o separador de miles.
Esto es para la retención de ITBMS, si lo envías, se retiene el 50%. Somos agentes de retención de impuestos, y el 50% de los impuestos que retenemos son reportados a la Dirección General de Impuestos (DGI).
email	 String MaxLength:100
 	Si	 Email del Tarjeta habiente
phone	 Numeric MaxLength:16
 	Si	 Teléfono del Tarjeta habiente.
Sólo enteros. Ejemplo "66666666".
address	 String MaxLength:100	No	 Dirección del la tarjeta
concept	 String MaxLength:100
 	Si	 Concepto de la transacción
Diferencia entre concepto y descripción. No hay diferencia, puedes introducir cualquier información que creas que se ajusta a cada campo.
description	 String MaxLength:150
 	Si	 Descripción de la transacción
ipCheck	 Ip (0.0.0.0) 	No	 Dirección Ip del Comprador, está información es analizada para fraude de la transacción. También admitimos IPv6.
isForm	true	No	 Solo debe enviarse si se desea implementar el proceso de 3DS en una transacción y el valor que recibe únicamente es: true. Requerido para validar pagos ante el emisor (3DS).
resultType	 WEB_REDIRECT	No	 Solo debe enviarse si se desea implementar el proceso de 3DS en una transacción y el valor que recibe únicamente es: WEB_REDIRECT. Requerido para validar pagos ante el emisor (3DS).
returnUrlString	http://www.alam-brito.com/transaction-pf	No	 Solo debe enviarse si se desea implementar el proceso de 3DS en una transacción. Recibe la URL de su aplicación a la cual se redirecccionar al usuario cuando termine el proceso de validación de 3DS. Requerido para validar pagos ante el emisor (3DS).
lang	 String MaxLength:2	No	
 Idioma de la transacción. Valores posibles:

EN para Inglés
ES para Español
customFieldValues	
 Array de campos con formato: (id, label, value)

No	 Información adicional de la transacción. Serán retornados cuando implementas el api de consulta de transacciones
cardInformation	 Arreglo de campos con formato: (cardNumber,  expMonth, expYear, 
cvv, firstName, lastName, cardType)	Si	
 Información de la tarjeta de crédito del comprador.

cardNumber: Número de la tarjeta de crédito
expMonth: Mes en el que expira la tarjeta
expYear: Año en el que expira la tarjeta
cvv: código de seguridad
firstName: Nombre del cliente
lastName: Apellido del cliente
cardType: Tipo de tarjeta VISA o MASTERCARD
Requerido en los casos de Tx: AUTH_CAPTURE y AUTH.
codOper	String MaxLength:100	No	Código de operación de la transacción autorizada. Requerido en los casos de Tx: CAPTURE, RECURRENT, REVERSE_AUTH , REVERSE_CAPTURE.
threeDSInformation	 Arreglo de campos con formato: (cardholderAuthenticationValue,  
authenticationIndicator,  directoryServerTranId, Version,)	No	
cardholderAuthenticationValue: Este campo representa el CAVV, TAVV, UCAF (Cardholder authentication verification value) - Obligatorio sí tiene un proveedor de 3DS externo
authenticationIndicator: Indicador E-commerce. Valores: '0', '1', '2', '5', '6', o '7'. (Opcional)
directoryServerTranId: 3DS/Directory Server Transaction ID Requerido para procesar 3DS protocol
Version: 2
IMPORTANTE — Esto sólo se utiliza si se integra con un proveedor de 3DS externo fuera del entorno de PagueloFacil y en el proceso le dan la información para rellenar estos campos.
Parámetros de respuesta
Nombre	Tipo	Formato	Descripción
headerStatus	JSON	 	Header Status, Indica el estado de la consulta
     code	Integer	 	Código del estado de la respuesta.
     description	String	 	Descripción del estado de la respuesta.  
serverTime	Date as String	yyyy-MM-dd'T'HH:mm:ss	Fecha y hora del servidor.
data	String | JSON | JsonArray	 	Contenido de la respuesta del servicio
     date	DateTime	yyyy-MM-dd'T'HH:mm:ss	Fecha y Hora de la transacción
     url3DSRef

String

Ejemplo: https://host.paguelofacil.com/restTx/v2/response/referencePage/AUTH_CAP-8J6XIC

Si	 Recibirá el url al cual debe redireccionar al usuario para la autenticación de la transacción ante el emisor de la tarjeta. Será el único parámetro devuelto en la caso de pagos validados por el emisor (3DS).
     authStatus	String	 	Código ISO de aprobación o denegación proveído por la marca (VISA/Mastercard). Para mayor información visite: Mastercard 
     description	String	 	Descripción enviada por el comercio al momento de solicitar la transacción.
     type	String	VISA / MASTERCARD	Proveedor de la tarjeta usada para la transacción
     txDescriptor

String	 	 El softdescriptor puede modificar y/o adicionar información que ve el tarjeta habiente en sus notificaciones y/o estado de cuenta de su tarjeta.
     totalPay	String	 	Monto total de la transacción
     binInfo	JSON	 	Información de fraude de la tarjeta (El retorno de estos datos puede variar según el proveedor). Contiene datos como: País y Banco emisor de la tarjeta, score de Riesgo de la transacción, de la IP del tarjeta habiente valorado comunmente en 0 (Menor riesgo)  y 99.99 (Mayor Riesgo).
     name	String	 	Nombre del tarjetahabiente
     displayNum	String	 	Últimos digitos de la tarjeta
     operationType	String	 	
Tipo de operación. Los valores recibidos son:

AUTH (Pre-Autorización),
CAPTURE (Captura),
AUTH_CAPTURE (Sale, Autorización y Captura),
3DS (Validación de Fraude)
RECURRENT
REVERSE
REVERSE_CAPTURE
     returnUrl	String	 	Url para mostrar un recibo de pago del detalle de la transacción con los datos de la transacción.
 requestPayAmount	Numeric	 	Monto solicitado en la petición de la petición
     email	String	 	Correo del cliente
     codOper	String	 	Código de operación de la transacción, es la referencia que debe usarse para consultar y/o operar con los servicios de PagueloFacil, para reversar, devolver y/o volver a procesar una transacción.
     status	Boolean	 	Indica si la transacción fue aprobada (1) o declinada (0), Con reembolso parcial (1), reembolsada (3) y Anulada (4). 
     messageSys	Boolean	 	Indica el mensaje del sistema. Mensaje de autorización de las marcas Visa y MasterCard. Ver Unavailable aparece porque la dirección que envía es válida AVS (Address Verification Service) que indica si la dirección es la asociada a la tarjeta  correspondientes al código ISO de authStatus.
success	Boolean	 	Retorna true si el headerStatus es SUCCESS
Excepciones y errores
❗Errores generales (300–500)
Código	Mensaje	Descripción
300	There was an error	Ocurrió un error
500	Invalid Session	Sesión inválida
🛒 Errores de comercio y transacciones (600–666)
Código	Mensaje	Descripción
600	MERCHANT NOT VALID	Código Web (CCLW) incorrecto.
601	MERCHANT SUSPENDED	El comercio ha sido desactivado por falta de procesamiento en los últimos 90 días.
602	MISSING ARGUMENTS	Faltan parámetros en la solicitud del servicio.
603	AMOUNT LESS THAN MINIMUM	El monto de la transacción es menor al mínimo permitido al comercio.
604	AMOUNT GREATER THAN MAXIMUN	El monto de la transacción es mayor al máximo permitido al comercio.
605	CREDIT CARD NUMBER NOT VALID	Número de tarjeta no válido.
606	SECURITY CODE INVALID	Número de código de verificación no válido.
607	CREDIT CARD TYPE NOT VALID	Número de tarjeta no válido.
608	INVALID EMAIL	Formato de email no válido.
609	INVALID NAME	Nombre demasiado corto o largo.
610	INVALID LAST NAME	Apellido demasiado corto o largo.
611	INVALID PHONE NUMBER	Número de teléfono no válido.
612	TX DUPLICATE	Más de 3 transacciones con la misma tarjeta y datos de procesamiento en menos de 5 minutos.
613	LIMIT MONTH	Límite mensual alcanzado (general o del servicio).
614	LIMIT DAY	Límite diario alcanzado (general o del servicio).
615	INVALID SERVICE GATEWAY OR DATA GATEWAY	La configuración de su comercio no es correcta.
616	EMAIL PAYMENT IS PAY	Este emailPago ya fue pagado.
617	EMAIL PAYMENT IS EXPIRED	Este emailPago ya caducó.
618	MERCHANT DOES NOT ALLOW BATCH PROCESSING	El comercio no permite procesamiento por lotes.
619	THE CASH PAY IS EXPIRED	El pago en efectivo ha caducado.
620	INVALID RELATED TX	Transacción relacionada inválida.
621	TX IS DECLINE	Transacción rechazada.
622	TX WAS CAPTURED	Transacción capturada.
623	TX WAS REVERSED	Transacción reembolsada.
624	INVALID TYPE	Tipo de transacción inválido.
625	INVALID REVERSE ACTION	Acción de reembolso no válida.
626	INVALID REVERSE TIME	Tiempo de reembolso agotado.
627	INVALID REVERSE INSUFFICIENT BALANCE	Fondos insuficientes para reembolso.
628	INVALID REVERSE INVALID AMOUNT, FUNDS ON HOLD	Monto inválido para reverso, fondos retenidos.
629	CREDIT CARD NOT VALID FOR GATEWAY	Tarjeta no válida para este gateway.
630	USER ACCOUNT NOT VALID	Cuenta de usuario no válida.
631	FRAUD DETECTED	Fraude detectado.
632	TRANSACTION APRROVED IS REQUIRED	Se requiere una transacción aprobada.
633	The rule exception was triggered	Se activó una regla de excepción.
634	The process code is invalid or has expired	El código de proceso es inválido o expiró.
640	Missing params	Faltan parámetros.
650	Invalid response	Respuesta inválida.
651	Invalid expiration date	Fecha de expiración inválida.
652	Related Tx has a claim, cannot act on this TX	La transacción tiene un reclamo, no se puede operar.
653	Function Not Implemented	Función no implementada.
654	Invalid card	Tarjeta inválida.
660	Fraud Rules Detected	Se detectaron reglas de fraude.
661	TX IS VOIDED	Transacción anulada.
662	MERCHANT SERVICE DISABLED	Servicio de comercio deshabilitado.
663	INVALID MERCHANT SERVICE	Servicio de comercio inválido.
664	INVALID SERVICE	Servicio inválido.
665	INVALID GATEWAY	Gateway inválido.
666	INVALID MERCHANT SERVICE MANUAL PROCESS CODE	Código de proceso manual inválido.
🔄 Estados de transacción extendidos (60002–60007)
Código	Mensaje	Descripción
60002	TX Denied	Transacción denegada.
60003	TX Pending	Transacción pendiente.
60004	Transaction not processed by cardholder	Transacción no procesada por el tarjetahabiente.
60005	ProcessTx data not found	Datos de transacción no encontrados.
60006	Your request is being processed	Su solicitud está siendo procesada.
60007	Transaction already processed	Transacción ya procesada.