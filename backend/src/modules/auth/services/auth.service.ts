import { Injectable, UnauthorizedException, ConflictException, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes } from 'crypto';
import type { IAuthRepository } from '../interfaces/iauth.repository';
import { LoginDto } from '../dto/login.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { InviteUserDto } from '../dto/invite-user.dto';
import type { usuarios } from '../../../../generated/prisma/client';

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    organizationId: string;
}

export interface AuthResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId: string;
    };
}

@Injectable()
export class AuthService {
    private readonly SALT_ROUNDS = 10;

    constructor(
        @Inject('IAuthRepository')
        private readonly authRepository: IAuthRepository,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly mailerService: MailerService,
    ) {}

    // ==================== Registro de Usuario ====================

    async registerUser(registerDto: RegisterUserDto): Promise<AuthResponse> {
        // Validar que la organización existe
        const organization = await this.authRepository.findOrganizationById(registerDto.organizationId);
        if (!organization) {
            throw new NotFoundException('La organización especificada no existe');
        }

        // Validar que el email no está en uso
        const existingUser = await this.authRepository.existsUserByEmail(registerDto.email);
        if (existingUser) {
            throw new ConflictException('El correo electrónico ya está registrado');
        }

        // Hash de la contraseña
        const passwordHash = await this.hashPassword(registerDto.password);

        // Crear usuario
        const user = await this.authRepository.createUser(registerDto, passwordHash);

        // Generar token
        const token = await this.generateToken(user);

        // Crear sesión
        await this.createSession(user.id, token);

        return {
            accessToken: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.nombre_completo,
                role: user.rol,
                organizationId: user.organizacion_id,
            },
        };
    }

    // ==================== Login ====================

    async login(loginDto: LoginDto): Promise<AuthResponse> {
        // Validar credenciales
        const user = await this.validateUser(loginDto);

        // Generar token
        const token = await this.generateToken(user);

        // Eliminar sesiones anteriores y crear nueva
        await this.authRepository.deleteUserSessions(user.id);
        await this.createSession(user.id, token);

        return {
            accessToken: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.nombre_completo,
                role: user.rol,
                organizationId: user.organizacion_id,
            },
        };
    }

    // ==================== Validación de Usuario ====================

    async validateUser(loginDto: LoginDto): Promise<usuarios> {
        const user = await this.authRepository.findUserByEmail(loginDto.email);

        if (!user) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        if (!user.activo) {
            throw new UnauthorizedException('Usuario desactivado. Contacte al administrador');
        }

        // Validar contraseña
        const isPasswordValid = await this.comparePassword(loginDto.password, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        return user;
    }

    // ==================== Validación de Token ====================

    async validateToken(tokenId: string): Promise<usuarios | null> {
        const session = await this.authRepository.findSessionByTokenId(tokenId);

        if (!session) {
            return null;
        }

        // Verificar si la sesión ha expirado
        if (new Date() > session.expira_en) {
            await this.authRepository.deleteSession(session.id);
            return null;
        }

        // Obtener el usuario de la sesión
        return await this.authRepository.findUserById(session.usuario_id);
    }

    // ==================== Logout ====================

    async logout(userId: string): Promise<void> {
        await this.authRepository.deleteUserSessions(userId);
    }

    // ==================== Cambio de Contraseña ====================

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
        const user = await this.authRepository.findUserById(userId);

        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        // Validar contraseña antigua
        const isPasswordValid = await this.comparePassword(oldPassword, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('La contraseña actual es incorrecta');
        }

        // Hash de nueva contraseña
        const newPasswordHash = await this.hashPassword(newPassword);

        // Actualizar contraseña y forzar re-login invalidando sesiones
        await this.authRepository.updatePassword(userId, newPasswordHash);
        await this.authRepository.deleteUserSessions(userId);
    }

    // ==================== Helpers Privados ====================

    private async hashPassword(password: string): Promise<string> {
        return await bcrypt.hash(password, this.SALT_ROUNDS);
    }

    private async comparePassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }

    private async generateToken(user: usuarios): Promise<string> {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.rol,
            organizationId: user.organizacion_id,
        };

        return this.jwtService.sign(payload);
    }

    private async createSession(userId: string, token: string): Promise<void> {
        const tokenId = randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1); // 1 día

        await this.authRepository.createSession(userId, tokenId, expiresAt);
    }

    // ==================== Métodos de Usuario ====================

    async getUserById(userId: string): Promise<usuarios> {
        const user = await this.authRepository.findUserById(userId);
        
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        return user;
    }

    async deactivateUser(userId: string, requestingOrgId: string): Promise<void> {
        const user = await this.authRepository.findUserById(userId);
        if (!user) throw new NotFoundException('Usuario no encontrado');
        if (user.organizacion_id !== requestingOrgId) {
            throw new ForbiddenException('No tienes permiso para modificar usuarios de otra organización');
        }
        await this.authRepository.deactivateUser(userId);
        await this.authRepository.deleteUserSessions(userId);
    }

    // ==================== Consulta de Usuarios por Organización ====================

    async getUsersByOrganization(organizationId: string): Promise<usuarios[]> {
        return this.authRepository.findUsersByOrganizationId(organizationId);
    }

    async setUserStatus(userId: string, activo: boolean, requestingOrgId: string): Promise<usuarios> {
        const user = await this.authRepository.findUserById(userId);
        if (!user) throw new NotFoundException('Usuario no encontrado');
        if (user.organizacion_id !== requestingOrgId) {
            throw new ForbiddenException('No tienes permiso para modificar usuarios de otra organización');
        }
        return this.authRepository.setUserStatus(userId, activo);
    }

    async updateUserRole(userId: string, rol: string, requestingOrgId: string): Promise<usuarios> {
        const user = await this.authRepository.findUserById(userId);
        if (!user) throw new NotFoundException('Usuario no encontrado');
        if (user.organizacion_id !== requestingOrgId) {
            throw new ForbiddenException('No tienes permiso para modificar usuarios de otra organización');
        }
        return this.authRepository.updateUserRole(userId, rol);
    }

    async deleteUser(userId: string, requestingOrgId: string): Promise<void> {
        const user = await this.authRepository.findUserById(userId);
        if (!user) throw new NotFoundException('Usuario no encontrado');
        if (user.organizacion_id !== requestingOrgId) {
            throw new ForbiddenException('No tienes permiso para eliminar usuarios de otra organización');
        }
        // Los admins (SUPERADMIN) nunca se pueden eliminar
        if (user.rol === 'SUPERADMIN') {
            throw new ForbiddenException('No se puede eliminar a un administrador. Cambia su rol primero si deseas eliminarlo.');
        }
        // El repositorio limpia facturas, logs y sesiones en una transacción
        await this.authRepository.deleteUser(userId);
    }

    // ==================== Recuperación de Contraseña ====================

    /**
     * Genera un token seguro, lo persiste en la DB y envía el email.
     * Siempre responde con el mismo mensaje (no revela si el email existe).
     */
    async forgotPassword(email: string): Promise<void> {
        const user = await this.authRepository.findUserByEmail(email);

        // Respuesta idéntica independientemente de si el usuario existe,
        // para no filtrar información de qué cuentas existen.
        if (!user || !user.activo) return;

        const token     = randomBytes(32).toString('hex');          // 64 char hex
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);   // 30 minutos

        await this.authRepository.saveResetToken(user.id, token, expiresAt);

        const resetUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200')}/auth/reset-password?token=${token}`;

        await this.mailerService.sendMail({
            to:      user.email,
            subject: '🔐 Restablece tu contraseña en Expensly',
            html:    this.buildForgotPasswordEmailHtml(user.nombre_completo, resetUrl),
        });
    }

    /**
     * Verifica el token, actualiza la contraseña y liquida todas las sesiones activas.
     */
    async resetPassword(token: string, newPassword: string): Promise<void> {
        const user = await this.authRepository.findUserByResetToken(token);

        if (!user) {
            throw new UnauthorizedException('Token inválido o expirado');
        }

        if (!user.reset_token_expires_at || new Date() > user.reset_token_expires_at) {
            await this.authRepository.clearResetToken(user.id);
            throw new UnauthorizedException('El token ha expirado. Solicita uno nuevo');
        }

        const passwordHash = await this.hashPassword(newPassword);
        await this.authRepository.updatePassword(user.id, passwordHash);
        await this.authRepository.clearResetToken(user.id);
        await this.authRepository.deleteUserSessions(user.id);  // fuerza re-login
    }

    // ── Plantilla HTML: recuperación de contraseña ───────────────────────────────
    private buildForgotPasswordEmailHtml(name: string, resetUrl: string): string {
        return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1d58ef,#4f46e5);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;letter-spacing:-0.5px;">&#128274; Expensly</h1>
          <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">Recuperación de contraseña</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;">Hola, ${name} 👋</h2>
          <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta.<br>
            Este enlace es válido por <strong>30 minutos</strong>.
          </p>

          <a href="${resetUrl}"
             style="display:inline-block;background:#1d58ef;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Restablecer contraseña &rarr;
          </a>

          <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
            Si no solicitaste este cambio, ignora este correo. Tu contraseña no será modificada.
          </p>
          <p style="margin:8px 0 0;color:#cbd5e1;font-size:11px;word-break:break-all;">
            ${resetUrl}
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">Este correo fue enviado automáticamente por Expensly. Por favor no respondas.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
    }

    async inviteUser(dto: InviteUserDto, organizationId: string): Promise<{ user: usuarios; tempPassword: string }> {
        // Verificar que el email no esté en uso
        const exists = await this.authRepository.existsUserByEmail(dto.email);
        if (exists) {
            throw new ConflictException('El correo electrónico ya está registrado en el sistema');
        }

        // Generar contraseña temporal segura
        const tempPassword = 'Exp_' + randomBytes(6).toString('base64url');
        const passwordHash = await this.hashPassword(tempPassword);

        // Crear usuario activo=true para que pueda iniciar sesión de inmediato
        const user = await this.authRepository.createUser(
            {
                organizationId,
                name: dto.nombre?.trim() || dto.email.split('@')[0],  // nombre o parte local del email
                email: dto.email,
                password: tempPassword,           // no usado, ya hasheamos arriba
                rol: dto.rol,
                isActive: true,
            },
            passwordHash,
        );

        // Enviar correo de invitación
        const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
        await this.mailerService.sendMail({
            to: dto.email,
            subject: '🎉 Te han invitado a Expensly',
            html: this.buildInviteEmailHtml(dto.email, tempPassword, frontendUrl),
        });

        return { user, tempPassword };
    }

    // ── Plantilla HTML del correo de invitación ──────────────────────────────
    private buildInviteEmailHtml(email: string, tempPassword: string, frontendUrl: string): string {
        return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;letter-spacing:-0.5px;">✉️ Expensly</h1>
          <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">Gestión de gastos empresariales</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;">¡Fuiste invitado al equipo!</h2>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Un administrador te ha dado acceso a <strong>Expensly</strong>.
            Usa las siguientes credenciales para iniciar sesión y configurar tu cuenta.
          </p>

          <!-- Credentials box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.6px;">Correo</p>
              <p style="margin:0 0 16px;font-size:15px;color:#1e293b;font-weight:700;">${email}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.6px;">Contraseña temporal</p>
              <p style="margin:0;font-size:18px;color:#4f46e5;font-weight:800;letter-spacing:1px;font-family:monospace;">${tempPassword}</p>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;color:#64748b;font-size:13px;line-height:1.6;">
            ⚠️ Te recomendamos cambiar tu contraseña después del primer inicio de sesión.
          </p>

          <a href="${frontendUrl}/auth/login"
             style="display:inline-block;background:#4f46e5;color:#fff;padding:13px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Ingresar a Expensly →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">Este correo fue enviado automáticamente. Si no esperabas esta invitación ignóralo.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
    }
}
