import type { usuarios, sesiones, organizaciones } from '../../../../generated/prisma/client';
import { RegisterUserDto, UpdateUserDto } from '../dto/register-user.dto';
import { OnboardingCompanyDto, UpdateCompanyDto } from '../dto/onboarding-company.dto';

export interface IAuthRepository {
    // Operaciones de Usuario
    findUserByEmail(email: string): Promise<usuarios | null>;
    findUserById(id: string): Promise<usuarios | null>;
    createUser(data: RegisterUserDto, passwordHash: string): Promise<usuarios>;
    updateUser(userId: string, data: UpdateUserDto): Promise<usuarios>;
    deactivateUser(userId: string): Promise<usuarios>;
    setUserStatus(userId: string, activo: boolean): Promise<usuarios>;
    updateUserRole(userId: string, rol: string): Promise<usuarios>;
    deleteUser(userId: string): Promise<void>;
    
    // Operaciones de Sesión
    createSession(userId: string, tokenId: string, expiresAt: Date): Promise<sesiones>;
    findSessionByTokenId(tokenId: string): Promise<sesiones | null>;
    deleteSession(sessionId: string): Promise<void>;
    deleteUserSessions(userId: string): Promise<void>;
    
    // Operaciones de Organización
    findOrganizationById(id: string): Promise<organizaciones | null>;
    findOrganizationByRuc(ruc: string): Promise<organizaciones | null>;
    createOrganization(data: OnboardingCompanyDto): Promise<organizaciones>;
    updateOrganization(organizationId: string, data: UpdateCompanyDto): Promise<organizaciones>;
    
    // Operaciones de Suscripción
    createSuscripcionTrial(organizacionId: string, plan: string, trialIniciaEn: Date, trialTerminaEn: Date): Promise<void>;
    
    // Consultas de organización
    findUsersByOrganizationId(organizationId: string): Promise<usuarios[]>;

    // Validaciones
    existsUserByEmail(email: string): Promise<boolean>;
    existsOrganizationByRuc(ruc: string): Promise<boolean>;

    // Recuperación de contraseña
    saveResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
    findUserByResetToken(token: string): Promise<usuarios | null>;
    clearResetToken(userId: string): Promise<void>;
    updatePassword(userId: string, passwordHash: string): Promise<void>;
}