Condicionales
Nombre Requerido Tipo Formato
EQUAL No String {field}$eq{value}
IS_NULL	No	String	{field}$null
IS_NOT_NULL No String {field}$nnull
IS_TRUE	No	String	{field}$true
IS_FALSE No String {field}$false
IS_EMPTY	No	String	{field}$empty
IS_NOT_EMPTY No String {field}$IS_NOT_EMPTY
LIKE	No	String	{field}$lk{value}
NOT_LIKE No String {field}$nlk{value}
BETWEEN	No	String	{field}$bt{value}::{value2}
LESS_THAN No String {field}$lt{value}
LESS_THAN_OR_EQUAL	No	String	{field}$le{value}
GREATER_THAN No String {field}$gt{value}
GREATER_THAN_OR_EQUAL	No	String	{field}$ge{value}
IN No String {field}$in{value}::{value2}::{valueN}
NOT_IN	No	String	{field}$nin{value}::{value2}::{valueN}
NOT_EQUAL No String {field}$ne{value}
Operadores
Name Required Type Format
COUNT No String
{field}::COUNT

SUM No String
{field}::SUM

MAX No String
{field}::MAX

MIN No String {field}::MIN
AVG No String {field}::AVG
DISTINCT No String {field}::DISTINCT
COUNT_DISTINCT No String {field}::COUNT_DISTINCT
Response Code
Code Descripción
100 User / Password Invalid
200 Success
300 There was an error
310 There was an error, processing credit card
400 Invalid request
410 Invalid Api Key
420 Invalid Api Version
430 Invalid KWP
500 Invalid Session
510 Session Expired
520 User not started session
530 Haven't privileges to access the service
540 The user is already logged in the application, please close the session and try again.
550 Error saving data, in the database
551 Error, Invalid Field
560 You do not have privileges to access this service or funtionality.
900 URL TimeOut Connection
910 Please check, your connection internet.
920 There was an Exception.
