Enlace de Pago
Este proceso de pago también se conoce como pago de Offsite o botón de pago. Para realizar el procesamiento el cliente abandona su sitio web para procesar el pago y se redirige al sitio seguro de Payfacil.

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
Botones
En español

Copy to clipboard
https://assets.paguelofacil.com/images/btn-svg/btn_es.svg
En ingles

Copy to clipboard
https://assets.paguelofacil.com/images/btn-svg/btn_en.svg
Obtener URL de redirección (Método seguro)
Copia, pega en tu web el ejemplo de php. Modifica los parámetros CCLW, CMTN y CDSC

Ejemplo, php del código de petición de pago por método POST.

PHP
Copy to clipboard


$data = array(
"CCLW" => $cclw ,
"CMTN" => $amount,
"CDSC" => $descrition,
"RETURN_URL" => '68747470733A2F2F70616775656C6F666163696C73612E7A656E6465736B2E636F6D2F6167656E742F66696C746572732F3439313933393538',
"PF_CF" => '5B7B226964223A227472616D6974654964222C226E616D654F724C6162656C223A2249642064656C205472616D697465222C2276616C7565223A2254494432333435227D5D',
"PARM_1" => '19816201',
"EXPIRES_IN" => 3600,
);
$postR="";
foreach($data as $mk=>$mv) { $postR .= "&".$mk."=".$mv; }
$ch = curl_init();
curl_setopt($ch,CURLOPT_URL, "https://secure.paguelofacil.com/LinkDeamon.cfm");

//curl_setopt($ch,CURLOPT_URL, "https://secure.paguelofacil.com/LinkDeamon.cfm/AUTH");   ****En Caso de querer Pre-autorizar  y capturar en procesos separados.
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt( $ch, CURLOPT_AUTOREFERER, true );
curl_setopt( $ch, CURLOPT_FOLLOWLOCATION, true );
curl_setopt($ch,CURLOPT_RETURNTRANSFER,true);
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/x-www-form-urlencoded','Accept: */*'));
curl_setopt($ch,CURLOPT_POSTFIELDS,$postR);
$result = curl_exec($ch);
URL para re-dirección
Toma el Valor url , de la respuesta del servicio y realiza la redirección. De esta forma ninguno de tis datos confidenciales como CMTN y CCLW son expuestos a terceros.


{
"headerStatus":{
"code":200,"description":"Success"},
"serverTime":"2021-01-12T16:13:50","message":"Success",
"data":{"url":"https://checkout.paguelofacil.com?code=LK-RQC5CO5G3TLNNJUU","code":"LK-RQC5CO5G3TLNNJUU"},
"success":true
}

IMPORTANTE — Debes generar un nuevo enlace para cada transacción que deseas realizar. Las url son de un solo uso.
Descripción de los parámetros
Parámetro	Tipo	Requerido	Descripción
CCLW	String
Ej.: A7BFCAF7B6……….	Si	Este es el código web suministrado por Payfacil y que identifica a su comercio
CMTN	Numeric, Money
Ej.: 10.00 – 1450.15 – 9.14	Si	Monto de la compra
CTAX	Numeric, Money
Ej.: 7.00 – 70.00 – 0.14	No	Monto correspondiente al ITBMS dentro del monto de la transacción
CDSC	String
MaxLength:150	Si	Descripción de la compra
RETURN_URL	String URL codificado en Hexadecimal	No	URL de retorno donde desea recibir la respuesta
PF_CF	String JSON codificado en Hexadecimal	No	String en formato JSON con la siguiente estructura [ {"id":"3Z4YNBQ","nameOrLabel":"id","type":"hidden","value":"3Z4YNBQ"}]
CARD_TYPE	String separado por comas	No	Sirve para determinar que métodos de pago, queremos mostrar en nuestro enlace de pago. Valores: CASH, CARD ***Opcional***
PARM_1	String
MaxLength:150	No	***Parámetro personalizado***, es posible enviar mas de 1 y puedes nombrarlo como desees, todos son retornados en la respuesta.
EXPIRES_IN

integer
Ej.: 3600 – 600 – 60	No	Cantidad de segundos máxima que desea recibir el pago
Respuesta
PagueloFacil automáticamente genera una vista de respuesta al usuario final, pero si lo desea se puede retornar la transacción a su página web.  Entonces, debes enviar el parámetro RETURN_URL con una URL válida códificada como Hexadecimal y su sitio será el encargado de proporcionarle una respuesta al usuario final sobre el estado de su transacción.

Transacción Aprobada
Transacción Aprobada
Transacción Denegada
Transacción Denegada
Descripción de los parámetros
Parámetro	Descripción
TotalPagado	0 si denegada, el monto cobrado si es aceptada
Fecha	Fecha de la transacción en formato dd/mm/yyyy
Hora	Hora de la transacción en formato HH:MM.SS
Tipo	Tipo de tarjeta VISA , MC para MasterCard, Wallet para transacciones recibidas a través de PagueloFacil App
Oper	Numero de Operación alfanumérico
Usuario	Nombre y Apellidos del tarjeta habiente
Email	Email del tarjetahabiente
Estado	Aprobada o Denegado
Razon	Por que fue Denegada la transacción por el banco emisor de la tarjeta de crédito. Solo se envía cuando la respuesta es denegada
PARM_1	valores enviados en la solicitud, son retornados tal como fueron enviados.
Ejemplo de parámetros de Retorno 
Copy to clipboard

//Pagos a través de anónimo tipo VISA
{"TotalPagado":"3.21","Fecha":"27\/07\/2021","Hora":"08:59:45","Tipo":"VISA","Oper":"SANDBOX_LK-SKADZYRMUMB4","Usuario":"prueba pf","Email":"correo@prueba.com","Estado":"Aprobada","Razon":"VER UNAVAILBLE","CMTN":"3.21","CDSC":"https:\/\/woocommerce.pfserver.net Orden Nro.719","CCLW":"1B09E4FCE502FE86540D14AC1031BDF54B399D919A23EAC43144CB540A8466642835566D3A77D3641CABF564BFA46608F5915083E110AE3C91F231459F05C27C"}

//Pagos a través de anónimo tipo PagoCash
{"TotalPagado":"0","Fecha":"27\/07\/2021","Hora":"09:03:58","Tipo":"CASH","Oper":"SANDBOX_PP48123808","Usuario":"null","Email":"correo@prueba.com","Estado":"Pendiente","Razon":"PENDING PAYMENT","CMTN":"3.21","CDSC":"https:\/\/woocommerce.pfserver.net Orden Nro.720","CCLW":"1B09E4FCE502FE86540D14AC1031BDF54B399D919A23EAC43144CB540A8466642835566D3A77D3641CABF564BFA46608F5915083E110AE3C91F231459F05C27C"}

//Pagos a través de PagueloFacil App (usuarios autenticados) tipo Mastercard
{"TotalPagado":"3.21","Fecha":"27\/07\/2021","Hora":"09:09:10","Tipo":"MC","Oper":"SANDBOX_PFW-Z6BCK2TCR2R","Usuario":"prueba pf","Email":"wajih@paguelofacil.com","Estado":"Aprobada","Razon":"VER UNAVAILBLE","CMTN":"3.21","CDSC":"https:\/\/woocommerce.pfserver.net Orden Nro.721","CCLW":"1B09E4FCE502FE86540D14AC1031BDF54B399D919A23EAC43144CB540A8466642835566D3A77D3641CABF564BFA46608F5915083E110AE3C91F231459F05C27C","activityCode":"0000000280","txAmount":"3.21","Order":"721"}

//Pagos a través de PagueloFacil App (usuarios autenticados) tipo PagoCash
{"TotalPay":"0","Date":"2021-07-27T09:16:50","Type":"CASH","Oper":"SANDBOX_PP98057873","User":"null","Email":"wajih@paguelofacil.com","Status":"Pending","StatusCode":"PUNTOPAGO","msg":"PENDING PAYMENT","RequestPay":"3.21","CDSC":"https:\/\/woocommerce.pfserver.net Orden Nro.722"}

//Pagos a través de PagueloFacil App (usuarios autenticados) tipo VISA
{"TotalPagado":"15.15","Fecha":"24\/07\/2021","Hora":"09:58:03","Tipo":"VISA","Oper":"SANDBOX_PFW-EP10GCGQKDI","Usuario":"Yousset Chacon","Email":"cpag3@prueba.com","Estado":"Aprobada","Razon":"VER UNAVAILBLE","CMTN":"15.15","CDSC":"https:\/\/woocommerce.pfserver.net Orden Nro.659","CCLW":"15224BE0CBB8EAAC33B53850FF71EAE732253AFC4AB224938A491D0B3E9D3F7B","activityCode":"0000000276","txAmount":"15.15","Order":"659"}

//Excepciones
{"headerStatus":{"code":615,"description":"INVALID SERVICE GATEWAY OR DATA GATEWAY"},"serverTime":"2021-08-11T21:56:20","message":null,"requestId":null,"data":{},"success":false}

 
Ejemplo de validación de Retorno
Copy to clipboard

//******** GET VARS *********/ 

////linkdemon///// 

$response = $_REQUEST; 

//Puede enviar los parámetros que desee en el enlace y le serán devueltas 


if ($TotalPagado>0 && $Estado != 'Denegada') { 

 //Podemos hacer validaciones adicionales de nuestro sistema 

echo "Pago Completado"; 

} else { 

 echo "Su pago ha presentado problema:";  

echo 'Estado: '.$Estado;


eecho 'Razón: '.$Razon; 
 

} 

 
Configuración de webhook
Es posible configurar un URL para recibir Vía POST el detalle de cada transacción, esto te permite obtener actualizaciones en tiempo real, automatizando procesos como la reconciliación de pagos y la validación de transacciones. Esto mejora la eficiencia operativa, reduce el margen de error y proporciona un control más preciso sobre las operaciones. Además, facilita la detección de anomalías para fortalecer la seguridad y permite integrar fácilmente los datos con otros sistemas, escalando sin problemas a medida que aumentan las transacciones.

 

Para la configutación del url debe comunicarse a través del correo: customerservice@paguelofacil.com

 

Parámetros enviado a través del webhook
Nombre	Tipo	Formato	Descripción
date	DateTime	yyyy-MM-dd'T'HH:mm:ss	Fecha y Hora de la transacción
relatedTx	String	STG-7TYUHNJMKLHUAM	Código de Operación de la transacción relacionada, como una autorización 3DS
description	String	 	Descripción enviada por el comercio al momento de solicitar la transacción.
merchantDescriptor

String	 	 El softdescriptor puede modificar y/o adicionar información que ve el tarjeta habiente en sus notificaciones y/o estado de cuenta de su tarjeta.
type	String	VISA / MC	Método de Pago
cardToken	String	 	CardToken interno, para uso interno
userLogn	String	 	username del usuario en PagueloFacil que se utilizó para generar la transacción.
idUsr	String	 	Identificador interno del usuario en PagueloFacil que se utilizó para generar la transacción.
revisionLevel	String	 	En caso de que la transacción requiera una revisión por parte del comercio indicará el nivel.
totalPay	String	Ej. 1356.25	Monto total de la transacción 
binInfo	JSON	 	Información de fraude de la tarjeta (El retorno de estos datos puede variar según el proveedor). Contiene datos como: País y Banco emisor de la tarjeta, score de Riesgo de la transacción, de la IP del tarjeta habiente valorado comúnmente en 0 (Menor riesgo)  y 99.99 (Mayor Riesgo).
displayNum	String	 	Últimos digitos de la tarjeta
returnUrl	String	 	Url para mostrar un recibo de pago del detalle de la transacción con los datos de la transacción.
requestPayAmount	Numeric	 	Monto solicitado en la petición de la petición
email	String	 	Correo del cliente
isExternalUrl	Boolean	 	De uso interno en PagueloFacil
authStatus	String	 	Código ISO de aprobación o denegación proveído por la marca (VISA/Mastercard). Para mayor información visite: Mastercard 
cardType	String	VISA / MC	Proveedor de la tarjeta usada para la transacción
userName	String	 	Nombre del tarjetahabiente
idtx	String	 	Identificador interno.
inRevision	Boolean	 	Indica si la transacción debe ser revisada por el dueño de la cuenta.
isTxCampaign	Boolean	 	Si es una transacciñon generada a través de una campaña
name	String	 	Nombre del tarjetahabiente
operationType	String	 	
Tipo de operación. Los valores recibidos son:

AUTH (Pre-Autorización),
CAPTURE (Captura),
AUTH_CAPTURE (Sale, Autorización y Captura),
3DS (Validación de Fraude)
RECURRENT
REVERSE
REVERSE_CAPTURE
txDescriptor

String	 	 El softdescriptor puede modificar y/o adicionar información que ve el tarjeta habiente en sus notificaciones y/o estado de cuenta de su tarjeta.
revisionOptions	String	 	Opciones de revisión.
codOper	String	 	Código de operación de la transacción, es la referencia que debe usarse para consultar y/o operar con los servicios de PagueloFacil, para reversar, devolver y/o volver a procesar una transacción.
status	Integer	 	Indica si la transacción fue aprobada (1) o declinada (0). 
messageSys	String	 	Indica el mensaje del sistema. Mensaje de autorización de las marcas Visa y MasterCard. Ver Unavailable aparece porque la dirección que envía es válida AVS (Address Verification Service) que indica si la dirección es la asociada a la tarjeta  correspondientes al código ISO de authStatus.
 

Ejemplo de parámetros del webhook 
Copy to clipboard

{
  "date": "2025-07-17T11:05:14",
  "relatedTx": "STG-7TYUHNJMKLHUAM",
  "description": " Yo soy Alam Brito de Cobre el mejor conductor de Uber",
  "merchantDescriptor": "PF*",
  "type": "MC",
  "cardToken": "1690163708596321459",
  "userLogn": "Brito Alam",
  "idUsr": 64,
  "revisionLevel": null,
  "totalPay": "38.39",
  "binInfo": {
    "id": "69c57914-890c-4413-a485-d3d171cb73ed",
    "risk_score": 55.0,
    "funds_remaining": 397.592,
    "queries_remaining": 19879,
    "ip_address": {
      "risk": 22.5,
      "city": {
        "confidence": 10,
        "geoname_id": 4744870,
        "names": {
          "de": "Ashburn",
          "en": "Ashburn",
          "es": "Ashburn",
          "fr": "Ashburn",
          "ja": "",
          "pt-BR": "Ashburn",
          "ru": "",
          "zh-CN": ""
        }
      },
      "continent": {
        "code": "NA",
        "geoname_id": 6255149,
        "names": {
          "de": "Nordamerika",
          "en": "North America",
          "es": "Norteamrica",
          "fr": "Amrique du Nord",
          "ja": "",
          "pt-BR": "Amrica do Norte",
          "ru": " ",
          "zh-CN": ""
        }
      },
      "country": {
        "confidence": 99,
        "geoname_id": 6252001,
        "is_high_risk": false,
        "iso_code": "US",
        "names": {
          "de": "USA",
          "en": "United States",
          "es": "Estados Unidos",
          "fr": "tats Unis",
          "ja": "",
          "pt-BR": "EUA",
          "ru": "",
          "zh-CN": ""
        }
      },
      "location": {
        "accuracy_radius": 1000,
        "average_income": 33772,
        "latitude": 39.0469,
        "local_time": "2025-07-17T12:05:14-04:00",
        "longitude": -77.4903,
        "metro_code": 511,
        "population_density": 1443,
        "time_zone": "America/New_York"
      },
      "postal": { "code": "20149", "confidence": 10 },
      "registered_country": {
        "geoname_id": 6252001,
        "iso_code": "US",
        "names": {
          "de": "USA",
          "en": "United States",
          "es": "Estados Unidos",
          "fr": "tats Unis",
          "ja": "",
          "pt-BR": "EUA",
          "ru": "",
          "zh-CN": ""
        }
      },
      "subdivisions": [
        {
          "confidence": 40,
          "geoname_id": 6254928,
          "iso_code": "VA",
          "names": {
            "de": "Virginia",
            "en": "Virginia",
            "es": "Virginia",
            "fr": "Virginie",
            "ja": "",
            "pt-BR": "Virgnia",
            "ru": "",
            "zh-CN": ""
          }
        }
      ],
      "traits": {
        "autonomous_system_number": 14618,
        "autonomous_system_organization": "AMAZON-AES",
        "domain": "amazonaws.com",
        "ip_address": "34.231.38.183",
        "isp": "Amazon.com",
        "organization": "Amazon.com",
        "user_type": "hosting"
      }
    },
    "credit_card": {
      "issuer": { "name": "BANCO DEL TESORO, C.A., BANCO UNIVERSAL" },
      "brand": "Mastercard",
      "country": "VE",
      "is_prepaid": false,
      "type": "debit"
    },
    "email": {
      "first_seen": "2024-02-29",
      "is_free": false,
      "is_high_risk": false
    },
    "disposition": { "action": "manual_review", "reason": "custom_rule" }
  },
  "displayNum": "21453",
  "returnUrl": "https://checkout.paguelofacil.com/pf/default-receipt/AUTH_CAP-IMUXPG",
  "requestPayAmount": 38.39,
  "email": "alambrito@decobre.com",
  "isExternalUrl": false,
  "authStatus": "00",
  "cardType": "MC",
  "userName": "Alam Brito",
  "idtx": 123456,
  "inRevision": false,
  "isTxCampaign": false,
  "name": "Alam Brito",
  "operationType": "AUTH_CAPTURE",
  "txDescriptor": "PF*",
  "revisionOptions": null,
  "codOper": "AUTH_CAP-IMUXPG",
  "status": 1,
  "messageSys": "Aprobada"
}

 
Tarjetas de Pruebas
Con estos números de Tarjetas, podrás realizar transacciones aprobadas en cualquiera de nuestros servicios. En cuanto a las fechas de vencimiento te funcionan cualquier mes y año mayor o igual a la fecha actual y para el código de seguridad (CVV2, CVC2) cualquiera tres digitos númericos.


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