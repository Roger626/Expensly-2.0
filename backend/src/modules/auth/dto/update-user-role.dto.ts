import { IsIn } from 'class-validator';
import { RolUsuario } from '../../../../generated/prisma/client';

export class UpdateUserRoleDto {
  @IsIn([RolUsuario.SUPERADMIN, RolUsuario.CONTADOR, RolUsuario.EMPLEADO])
  rol: RolUsuario;
}
