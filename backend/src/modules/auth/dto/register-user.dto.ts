import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsUUID, IsEmail, IsBoolean } from 'class-validator';
import { RolUsuario } from "../../../../generated/prisma/enums";

export class RegisterUserDto{

    @IsUUID()
    @IsNotEmpty({message: "El ID de su organizacion es obligatorio"})
    organizationId: string;

    @IsString()
    @IsNotEmpty({message: "El nombre es obligatorio"})
    @MinLength(2, {message: "El nombre debe tener al menos 2 caracteres"})
    @MaxLength(255, {message: "El nombre no debe exceder los 255 caracteres"})
    name: string;

    @IsString()
    @IsNotEmpty({message: "El correo electrónico es obligatorio"})
    @IsEmail({}, {message: "El correo electrónico no es válido"})
    email: string;

    @IsString()
    @IsNotEmpty({message: "La contraseña es obligatoria"})
    @MinLength(8, {message: "La contraseña debe tener al menos 8 caracteres"})
    @MaxLength(128, {message: "La contraseña no debe exceder los 128 caracteres"})
    password: string;

    @IsString()
    @IsNotEmpty({message: "El rol es obligatorio"})
    rol: RolUsuario = RolUsuario.EMPLEADO;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean = true;
}


export class UpdateUserDto{
    @IsUUID()
    @IsNotEmpty({message: "El ID de su organizacion es obligatorio"})
    organizationId: string;

    @IsString()
    @IsOptional()
    @MinLength(2, {message: "El nombre debe tener al menos 2 caracteres"})
    @MaxLength(255, {message: "El nombre no debe exceder los 255 caracteres"})
    name?: string;

    @IsString()
    @IsOptional()
    @IsEmail({}, {message: "El correo electrónico no es válido"})
    email?: string;

    @IsString()
    @IsOptional()
    @MinLength(8, {message: "La contraseña debe tener al menos 8 caracteres"})
    @MaxLength(128, {message: "La contraseña no debe exceder los 128 caracteres"})
    password?: string;

    @IsString()
    @IsOptional()
    rol?: RolUsuario = RolUsuario.EMPLEADO;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean = true;
}