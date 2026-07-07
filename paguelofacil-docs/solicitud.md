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