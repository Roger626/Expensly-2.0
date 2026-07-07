Payload
Nombre Tipo Formato Requerido Descripción
headerStatus Json Si Header Status, Indica el estado de la consulta
code Integer Si Código del estado de la respuesta
description String Si Descripción del estado de la respuesta
serverTime Date as String yyyy-MM-dd'T'HH:mm:ss Si Current Server Time
message String No Mensaje de la respuesta
success Boolean No Retorna true si el headerStatus es SUCCESS
data String | Json | JsonArray No Contenido de la repuesta del servicio
