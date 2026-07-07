import { Injectable, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import type { IAuthRepository } from '../interfaces/iauth.repository';
import { OnboardingCompanyDto } from '../dto/onboarding-company.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { AuthService, AuthResponse } from './auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolUsuario } from 'generated/prisma/enums';
import type { organizaciones } from 'generated/prisma/client';

export interface OnboardingResponse {
    organization: organizaciones;
    authData: AuthResponse;
}

const DEFAULT_CATEGORIES = [
    { nombre: 'Alimentación', codigo_contable: '100' },
    { nombre: 'Transporte', codigo_contable: '200' },
    { nombre: 'Servicios Públicos', codigo_contable: '300' },
    { nombre: 'Suministros de Oficina', codigo_contable: '400' },
    { nombre: 'Gastos de Viaje', codigo_contable: '500' },
];

@Injectable()
export class OnboardingService {
    constructor(
        @Inject('IAuthRepository')
        private readonly authRepository: IAuthRepository,
        private readonly authService: AuthService,
        private readonly prisma: PrismaService,
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
        // Validar que el RUC no exista (pre-tx validation — cheap, avoids entering tx)
        const existingOrg = await this.authRepository.existsOrganizationByRuc(companyDto.ruc);
        if (existingOrg) {
            throw new ConflictException('Ya existe una organización con este RUC');
        }

        // Validar que el email no esté en uso (pre-tx validation)
        const existingUser = await this.authRepository.existsUserByEmail(adminData.email);
        if (existingUser) {
            throw new ConflictException('El correo electrónico ya está registrado');
        }

        // Compute trial dates explicitly — reviewer fix #6
        const trialIniciaEn = new Date();
        const trialTerminaEn = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        // Plan: use DTO field or default to 'basic'
        const plan = companyDto.subscripcion || 'basic';

        // Atomic transaction — org + categories + suscripciones succeed or none do
        const organization = await this.prisma.$transaction(async (tx) => {
            // 1. Create organizaciones with trial dates + plan_suscripcion (backward compat)
            const org = await tx.organizaciones.create({
                data: {
                    razon_social: companyDto.razonSocial,
                    ruc: companyDto.ruc,
                    dv: companyDto.dv,
                    plan_suscripcion: plan,
                    trial_inicia_en: trialIniciaEn,
                    trial_termina_en: trialTerminaEn,
                },
            });

            // 2. Create default categories
            await tx.categorias.createMany({
                data: DEFAULT_CATEGORIES.map((cat) => ({
                    ...cat,
                    organizacion_id: org.id,
                })),
            });

            // 3. Create suscripciones Trial row
            // (reviewer fix #1: trial dates on organizaciones only, NOT duplicated here)
            await tx.suscripciones.create({
                data: {
                    organizacion_id: org.id,
                    plan,
                    estado: 'Trial',
                },
            });

            return org as organizaciones;
        });

        // 4. Register SUPERADMIN user (outside tx — pre-validated, unlikely to fail)
        const registerUserDto: RegisterUserDto = {
            organizationId: organization.id,
            name: adminData.name,
            email: adminData.email,
            password: adminData.password,
            rol: RolUsuario.SUPERADMIN,
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
