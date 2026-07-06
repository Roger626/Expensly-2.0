import { Injectable, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import type { IAuthRepository } from '../interfaces/iauth.repository';
import { OnboardingCompanyDto } from '../dto/onboarding-company.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { AuthService, AuthResponse } from './auth.service';
import { RolUsuario } from '../../../../generated/prisma/enums';
import type { organizaciones } from '../../../../generated/prisma/client';

export interface OnboardingResponse {
    organization: organizaciones;
    authData: AuthResponse;
}

@Injectable()
export class OnboardingService {
    constructor(
        @Inject('IAuthRepository')
        private readonly authRepository: IAuthRepository,
        private readonly authService: AuthService,
    ) {}

    // ==================== Onboarding Completo ====================

    async createOrganizationWithAdmin(
        companyDto: OnboardingCompanyDto,
        adminData: {
            name: string;
            email: string;
            password: string;
        },
    ): Promise<OnboardingResponse> {
        const [existingOrg, existingUser] = await Promise.all([
            this.authRepository.existsOrganizationByRuc(companyDto.ruc),
            this.authRepository.existsUserByEmail(adminData.email),
        ]);

        const conflicts: string[] = [];

        if (existingOrg) {
            conflicts.push('Ya existe una organización con este RUC');
        }

        if (existingUser) {
            conflicts.push('El correo electrónico ya está registrado');
        }

        if (conflicts.length > 0) {
            throw new ConflictException(conflicts.join('. '));
        }

        // Crear la organización
        const organization = await this.authRepository.createOrganization(companyDto);

        // Crear usuario administrador
        const registerUserDto: RegisterUserDto = {
            organizationId: organization.id,
            name: adminData.name,
            email: adminData.email,
            password: adminData.password,
            rol: RolUsuario.SUPERADMIN, // El primer usuario es superadmin
            isActive: true,
        };

        const authResponse = await this.authService.registerUser(registerUserDto);

        return {
            organization,
            authData: authResponse,
        };
    }

    // ==================== Operaciones de Organización ====================

    async getOrganizationById(organizationId: string): Promise<organizaciones> {
        const organization = await this.authRepository.findOrganizationById(organizationId);
        
        if (!organization) {
            throw new BadRequestException('Organización no encontrada');
        }

        return organization;
    }

    async getOrganizationByRuc(ruc: string): Promise<organizaciones | null> {
        return await this.authRepository.findOrganizationByRuc(ruc);
    }

    // ==================== Validaciones ====================

    async validateOrganizationExists(organizationId: string): Promise<boolean> {
        const organization = await this.authRepository.findOrganizationById(organizationId);
        return !!organization;
    }

    async validateRucAvailable(ruc: string): Promise<boolean> {
        return !(await this.authRepository.existsOrganizationByRuc(ruc));
    }
}
