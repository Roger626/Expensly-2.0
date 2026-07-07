Consultar Transacciones
A través de nuestas API's puedes consultar las transacciones por código de Operación "codOper"  y por rango de fechas. En esta documentación te damos un ejemplo de como consumir el servicio.

Prerrequisitos
ACCESS TOKEN
Token de acceso del usuario
Certificado SSL
TLS 1.3 o superior
 

Base URL de ambientes
Producción
https://admin.paguelofacil.com/
Pruebas
https://sandbox.paguelofacil.com/
Servicio GET
Copy to clipboard
/PFManagementServices/api/v1/MerchantTransactions/{Parameters}
Headers
Parámetro	Tipo	Formato	Requerido	Descripción
Authorization	String	 {your accessToken}	Si	Autenticación para acceso al servicio  ¿Cómo obtengo mi accessToken?
Parámetros
Parámetro	Tipo	Formato	Requerido	Descripción
Filter	String	{field}::{value}|{field2}::{value} Conditional	No	Permite realizar filtros y consultas sobre el servicio. Los Query Param son no casesensitive
Conditional	String	 	No	{field}{operator}{value}|{field2}{operator $bt}{value}::{value2}
Limit	Integer	 	No	Indica el numero maximo de resultados esperados
Offset	Integer	 	No	Indica desde donde se retornara la consulta, esto es usado para paginacion
Sort	String	{field},{-field2}	No	Permite ordenar la consulta, si quiere hacer un order descendente use - antes del campo
Field	String	{field},{field2::{Operator}}	No	Permite retornar solo los campos indicados, y aplicar operaciones sobre estos
Ejemplos
Por Campo
Rango de fechas
Utilizando Operatores
Copy to clipboard


///Ejemplo codOper
https://admin.paguelofacil.com/PFManagementServices/api/v1/MerchantTransactions?filter=codOper::AUTH_CAP-TL22CD