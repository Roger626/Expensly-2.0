import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IAuthRepository } from '../interfaces/iauth.repository';
import type { usuarios, sesiones, organizaciones, categorias } from '../../../../generated/prisma/client';
import { RegisterUserDto, UpdateUserDto } from '../dto/register-user.dto';
import { OnboardingCompanyDto, UpdateCompanyDto } from '../dto/onboarding-company.dto';

@Injectable()
export class AuthRepository implements IAuthRepository {
    constructor(private readonly prisma: PrismaService) {}

    // ==================== Operaciones de Usuario ====================
    
    async findUserByEmail(email: string): Promise<usuarios | null> {
        return await this.prisma.usuarios.findUnique({
            where: { email },
            include: {
                organizaciones: true,
            },
        });
    }

    async findUserById(id: string): Promise<usuarios | null> {
        return await this.prisma.usuarios.findUnique({
            where: { id },
            include: {
                organizaciones: true,
            },
        });
    }

    async createUser(data: RegisterUserDto, passwordHash: string): Promise<usuarios> {
        return await this.prisma.usuarios.create({
            data: {
                organizacion_id: data.organizationId,
                nombre_completo: data.name,
                email: data.email,
                password_hash: passwordHash,
                rol: data.rol,
                activo: data.isActive ?? true,
            },
            include: {
                organizaciones: true,
            },
        });
    }

    async updateUser(userId: string, data: UpdateUserDto): Promise<usuarios> {
        return await this.prisma.usuarios.update({
            where: { id: userId },
            data: {
                nombre_completo: data.name,
                email: data.email,
                rol: data.rol,
            },
            include: {
                organizaciones: true,
            },
        });
    }

    async deactivateUser(userId: string): Promise<usuarios> {
        return await this.prisma.usuarios.update({
            where: { id: userId },
            data: { activo: false },
        });
    }

    async setUserStatus(userId: string, activo: boolean): Promise<usuarios> {
        return await this.prisma.usuarios.update({
            where: { id: userId },
            data: { activo },
        });
    }

    async updateUserRole(userId: string, rol: string): Promise<usuarios> {
        return await this.prisma.usuarios.update({
            where: { id: userId },
            data: { rol: rol as any },
        });
    }

    async deleteUser(userId: string): Promise<void> {
        // Desvincular relaciones dependientes antes de eliminar el usuario.
        await this.prisma.facturas.updateMany({
            where: { usuario_id: userId },
            data: { usuario_id: null },
        });

        await this.prisma.logs_auditoria.updateMany({
            where: { usuario_id: userId },
            data: { usuario_id: null },
        });

        await this.prisma.sesiones.deleteMany({ where: { usuario_id: userId } });
        await this.prisma.usuarios.delete({ where: { id: userId } });
    }

    // ==================== Operaciones de Sesión ====================

    async createSession(userId: string, tokenId: string, expiresAt: Date): Promise<sesiones> {
        return await this.prisma.sesiones.create({
            data: {
                usuario_id: userId,
                token_id: tokenId,
                expira_en: expiresAt,
            },
        });
    }

    async findSessionByTokenId(tokenId: string): Promise<sesiones | null> {
        return await this.prisma.sesiones.findFirst({
            where: { token_id: tokenId },
            include: {
                usuarios: {
                    include: {
                        organizaciones: true,
                    },
                },
            },
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.prisma.sesiones.delete({
            where: { id: sessionId },
        });
    }

    async deleteUserSessions(userId: string): Promise<void> {
        await this.prisma.sesiones.deleteMany({
            where: { usuario_id: userId },
        });
    }

    // ==================== Operaciones de Organización ====================

    async findOrganizationById(id: string): Promise<organizaciones | null> {
        return await this.prisma.organizaciones.findUnique({
            where: { id },
        });
    }

    async findOrganizationByRuc(ruc: string): Promise<organizaciones | null> {
        return await this.prisma.organizaciones.findUnique({
            where: { ruc },
        });
    }

    async createOrganization(data: OnboardingCompanyDto): Promise<organizaciones> {
        const org = await this.prisma.organizaciones.create({
            data: {
                razon_social: data.razonSocial,
                ruc: data.ruc,
                dv: data.dv,
                plan_suscripcion: data.subscripcion || 'Trial',
            },
        });

        const DEFAULT_CATEGORIES = [
            { nombre: 'Alimentación', codigo_contable: '100' },
            { nombre: 'Transporte', codigo_contable: '200' },
            { nombre: 'Servicios Públicos', codigo_contable: '300' },
            { nombre: 'Suministros de Oficina', codigo_contable: '400' },
            { nombre: 'Gastos de Viaje', codigo_contable: '500' },

        ];

        await this.prisma.categorias.createMany({
            data: DEFAULT_CATEGORIES.map(cat => ({
                ...cat,
                organizacion_id: org.id,
            })),
        });
        return org;
    }

    async updateOrganization(organizationId: string, data: UpdateCompanyDto): Promise<organizaciones> {
        const updateData: any = {};
        
        if (data.razonSocial !== undefined && data.razonSocial !== null) {
            updateData.razon_social = data.razonSocial;
        }
        if (data.ruc !== undefined && data.ruc !== null) {
            updateData.ruc = data.ruc;
        }
        if (data.dv !== undefined && data.dv !== null) {
            updateData.dv = data.dv;
        }
        
        return await this.prisma.organizaciones.update({
            where: { id: organizationId },
            data: updateData,
        });
    }

    // ==================== Consultas de Organización ====================

    async findUsersByOrganizationId(organizationId: string): Promise<usuarios[]> {
        return await this.prisma.usuarios.findMany({
            where: { organizacion_id: organizationId },
            orderBy: { fecha_creacion: 'asc' },
        });
    }

    // ==================== Validaciones ====================

    async existsUserByEmail(email: string): Promise<boolean> {
        const count = await this.prisma.usuarios.count({
            where: { email },
        });
        return count > 0;
    }

    async existsOrganizationByRuc(ruc: string): Promise<boolean> {
        const count = await this.prisma.organizaciones.count({
            where: { ruc },
        });
        return count > 0;
    }

    // ==================== Recuperación de Contraseña ====================

    async saveResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
        await this.prisma.usuarios.update({
            where: { id: userId },
            data: {
                reset_token:            token,
                reset_token_expires_at: expiresAt,
            },
        });
    }

    async findUserByResetToken(token: string): Promise<usuarios | null> {
        return this.prisma.usuarios.findFirst({
            where: { reset_token: token },
        });
    }

    async clearResetToken(userId: string): Promise<void> {
        await this.prisma.usuarios.update({
            where: { id: userId },
            data: {
                reset_token:            null,
                reset_token_expires_at: null,
            },
        });
    }

    async updatePassword(userId: string, passwordHash: string): Promise<void> {
        await this.prisma.usuarios.update({
            where: { id: userId },
            data: { password_hash: passwordHash },
        });
    }
}
