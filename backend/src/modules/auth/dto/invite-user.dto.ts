import { IsEmail, IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { RolUsuario } from '../../../../generated/prisma/enums';

export class InviteUserDto {

    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
    email: string;

    /** Nombre visible del usuario. Si se omite, se usa la parte local del email. */
    @IsOptional()
    @IsString()
    nombre?: string;

    @IsString()
    @IsNotEmpty({ message: 'El rol es obligatorio' })
    @IsIn(
        [RolUsuario.SUPERADMIN, RolUsuario.CONTADOR, RolUsuario.EMPLEADO],
        { message: 'El rol debe ser SUPERADMIN, CONTADOR o EMPLEADO' },
    )
    rol: RolUsuario;
}
