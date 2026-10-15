import { 
    Controller, 
    Post, 
    Get, 
    Put, 
    Patch, 
    Delete, 
    Body, 
    Param, 
    HttpCode, 
    HttpStatus,
    UseGuards,
    Request,
    ValidationPipe,
    ClassSerializerInterceptor,
    UseInterceptors,
    ForbiddenException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

// Services
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';

// DTOs (Entrada)
import { LoginDto } from '../dto/login.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { CompleteOnboardingDto } from '../dto/complete-onboarding.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { InviteUserDto } from '../dto/invite-user.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';

// Entities (Salida)
import { UserEntity } from '../entities/user.entity';
import { OrganizationEntity } from '../entities/organization.entity';
import { AuthResponseEntity, OnboardingResponseEntity } from '../entities/auth-response.entity';

// Guards
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly onboardingService: OnboardingService
    ) {}

    // ==================== Onboarding ====================

    @Post('onboarding')
    @HttpCode(HttpStatus.CREATED)
    async completeOnboarding(
        @Body(ValidationPipe) dto: CompleteOnboardingDto
    ): Promise<OnboardingResponseEntity> {
        const result = await this.onboardingService.createOrganizationWithAdmin(
            dto.company,
            dto.admin
        );

        return plainToInstance(OnboardingResponseEntity, {
            organization: plainToInstance(OrganizationEntity, {
                id: result.organization.id,
                razonSocial: result.organization.razon_social,
                ruc: result.organization.ruc,
                dv: result.organization.dv,
                plan: result.organization.plan_suscripcion,
                fechaRegistro: result.organization.fecha_registro,
            }),
            authData: result.authData,
        });
    }

    // ==================== Autenticación ====================

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(
        @Body(ValidationPipe) registerDto: RegisterUserDto
    ): Promise<AuthResponseEntity> {
        const result = await this.authService.registerUser(registerDto);
        return plainToInstance(AuthResponseEntity, result);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body(ValidationPipe) loginDto: LoginDto
    ): Promise<AuthResponseEntity> {
        const result = await this.authService.login(loginDto);
        return plainToInstance(AuthResponseEntity, result);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Request() req) {
        await this.authService.logout(req.user.userId);
        return { message: 'Sesión cerrada exitosamente' };
    }

    // ==================== Recuperación de Contraseña ====================

    /**
     * Paso 1: el usuario ingresa su correo.
     * Siempre devuelve el mismo mensaje para no filtrar si el email existe.
     */
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(
        @Body(ValidationPipe) dto: ForgotPasswordDto,
    ) {
        await this.authService.forgotPassword(dto.email);
        return { message: 'Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
    }

    /**
     * Paso 2: el usuario llega desde el link del correo con el token.
     */
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(
        @Body(ValidationPipe) dto: ResetPasswordDto,
    ) {
        await this.authService.resetPassword(dto.token, dto.newPassword);
        return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' };
    }

    // ==================== Gestión de Usuario ====================

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async getProfile(@Request() req): Promise<UserEntity> {
        const user = await this.authService.getUserById(req.user.userId);
        
        return plainToInstance(UserEntity, {
            id: user.id,
            email: user.email,
            name: user.nombre_completo,
            role: user.rol,
            organizationId: user.organizacion_id,
            isActive: user.activo,
            createdAt: user.fecha_creacion,
        });
    }

    @Patch('change-password')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async changePassword(
        @Request() req,
        @Body(ValidationPipe) changePasswordDto: ChangePasswordDto
    ) {
        await this.authService.changePassword(
            req.user.userId,
            changePasswordDto.oldPassword,
            changePasswordDto.newPassword
        );
        return { message: 'Contraseña actualizada exitosamente' };
    }

    // ==================== Gestión de Usuarios de la Organización ====================

    @Get('users')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async getUsersByOrganization(@Request() req) {
        const users = await this.authService.getUsersByOrganization(req.user.organizationId);
        return users.map(u =>
            plainToInstance(UserEntity, {
                id:             u.id,
                email:          u.email,
                name:           u.nombre_completo,
                role:           u.rol,
                organizationId: u.organizacion_id,
                isActive:       u.activo,
                createdAt:      u.fecha_creacion,
            }),
        );
    }

    @Post('invite')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPERADMIN')
    @HttpCode(HttpStatus.CREATED)
    async inviteUser(
        @Request() req,
        @Body(ValidationPipe) dto: InviteUserDto,
    ) {
        const { user, tempPassword } = await this.authService.inviteUser(dto, req.user.organizationId);
        return {
            message: 'Invitación creada exitosamente',
            tempPassword,
            user: plainToInstance(UserEntity, {
                id:             user.id,
                email:          user.email,
                name:           user.nombre_completo,
                role:           user.rol,
                organizationId: user.organizacion_id,
                isActive:       user.activo,
                createdAt:      user.fecha_creacion,
            }),
        };
    }

    @Delete('deactivate/:userId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPERADMIN')
    @HttpCode(HttpStatus.OK)
    async deactivateUser(@Param('userId') userId: string, @Request() req) {
        await this.authService.deactivateUser(userId, req.user.organizationId);
        return { message: 'Usuario desactivado exitosamente' };
    }

    @Patch('users/:userId/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPERADMIN')
    @HttpCode(HttpStatus.OK)
    async setUserStatus(
        @Param('userId') userId: string,
        @Body(ValidationPipe) dto: UpdateUserStatusDto,
        @Request() req,
    ) {
        const user = await this.authService.setUserStatus(userId, dto.activo, req.user.organizationId);
        return plainToInstance(UserEntity, {
            id:             user.id,
            email:          user.email,
            name:           user.nombre_completo,
            role:           user.rol,
            organizationId: user.organizacion_id,
            isActive:       user.activo,
            createdAt:      user.fecha_creacion,
        });
    }

    @Patch('users/:userId/role')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPERADMIN')
    @HttpCode(HttpStatus.OK)
    async updateUserRole(
        @Param('userId') userId: string,
        @Body(ValidationPipe) dto: UpdateUserRoleDto,
        @Request() req,
    ) {
        const user = await this.authService.updateUserRole(userId, dto.rol, req.user.organizationId);
        return plainToInstance(UserEntity, {
            id:             user.id,
            email:          user.email,
            name:           user.nombre_completo,
            role:           user.rol,
            organizationId: user.organizacion_id,
            isActive:       user.activo,
            createdAt:      user.fecha_creacion,
        });
    }

    @Delete('users/:userId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('SUPERADMIN')
    @HttpCode(HttpStatus.OK)
    async deleteUser(@Param('userId') userId: string, @Request() req) {
        await this.authService.deleteUser(userId, req.user.organizationId);
        return { message: 'Usuario eliminado exitosamente' };
    }

    // ==================== Validaciones ====================

    @Get('validate-ruc/:ruc')
    @HttpCode(HttpStatus.OK)
    async validateRuc(@Param('ruc') ruc: string) {
        const isAvailable = await this.onboardingService.validateRucAvailable(ruc);
        return {
            available: isAvailable,
            message: isAvailable 
                ? 'RUC disponible' 
                : 'RUC ya registrado',
        };
    }

    @Get('organization/:id')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async getOrganization(
        @Param('id') id: string,
        @Request() req,
    ): Promise<OrganizationEntity> {
        // Prevent cross-org IDOR: a user can only fetch their own organization
        if (id !== req.user.organizationId) {
            throw new ForbiddenException('No tienes permiso para acceder a datos de otra organización');
        }
        const org = await this.onboardingService.getOrganizationById(id);
        
        return plainToInstance(OrganizationEntity, {
            id: org.id,
            razonSocial: org.razon_social,
            ruc: org.ruc,
            dv: org.dv,
            plan: org.plan_suscripcion,
            fechaRegistro: org.fecha_registro,
        });
    }
}
