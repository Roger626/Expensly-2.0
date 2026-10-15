// ─────────────────────────────────────────────────────────────────────────────
// Dominio — Usuarios
// ─────────────────────────────────────────────────────────────────────────────

// Roles tal como los envía el backend
export type RolBackend    = 'SUPERADMIN' | 'CONTADOR' | 'EMPLEADO';

// Roles para visualización en la UI
export type RolUsuario    = 'Admin' | 'Contador' | 'Empleado';
export type EstadoUsuario = 'Activo' | 'Pendiente' | 'Desactivado';

// ── Forma que devuelve el backend (GET /auth/users) ─────────────────────────
export interface UsuarioApiResponse {
  id:             string;
  email:          string;
  name:           string;
  role:           RolBackend;
  organizationId: string;
  isActive:       boolean;
  createdAt:      string;
}

// ── Modelo de UI ─────────────────────────────────────────────────────────────
export interface UsuarioTabla {
  id:             string;
  nombre:         string;
  email:          string;
  fechaAgregado:  string;
  rol:            RolUsuario;
  estado:         EstadoUsuario;
  iniciales:      string;
  color:          string;
}

// ── Payload para invitar usuario (POST /auth/invite) ─────────────────────────
export interface InvitePayload {
  email: string;
  rol:   RolBackend;
}

export interface InvitacionUsuario {
  email:   string;
  nombre?: string;
  rol:     RolUsuario | '';
}

export const ROLES_DISPONIBLES: RolUsuario[] = ['Admin', 'Contador', 'Empleado'];

// ── Mapeo rol backend → display ──────────────────────────────────────────────
const ROL_MAP: Record<RolBackend, RolUsuario> = {
  SUPERADMIN: 'Admin',
  CONTADOR:   'Contador',
  EMPLEADO:   'Empleado',
};

export const ROL_DISPLAY_TO_BACKEND: Record<RolUsuario, RolBackend> = {
  Admin:     'SUPERADMIN',
  Contador:  'CONTADOR',
  Empleado:  'EMPLEADO',
};

// Paleta de colores para avatares (se asigna por índice)
const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#14b8a6', '#3b82f6',
  '#8b5cf6', '#ef4444', '#10b981', '#f97316', '#06b6d4',
];

function getAvatarColor(id: string): string {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function getIniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Mapper API → UI ─────────────────────────────────────────────────────────
export function mapApiUsuarioToTabla(u: UsuarioApiResponse): UsuarioTabla {
  const estado: EstadoUsuario = u.isActive ? 'Activo' : 'Desactivado';
  const nombre = u.name ?? u.email.split('@')[0];
  return {
    id:            u.id,
    nombre,
    email:         u.email,
    fechaAgregado: new Date(u.createdAt).toLocaleDateString('es-PA', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    }),
    rol:    ROL_MAP[u.role] ?? 'Empleado',
    estado,
    iniciales: getIniciales(nombre),
    color:     getAvatarColor(u.id),
  };
}


export const MOCK_USUARIOS: UsuarioTabla[] = [
  {
    id: '1',
    nombre: 'Juan García',
    email: 'j.garcia@acmecorp.com',
    fechaAgregado: '12 Oct 2023',
    rol: 'Admin',
    estado: 'Activo',
    iniciales: 'JG',
    color: '#6366f1',
  },
  {
    id: '2',
    nombre: 'María López',
    email: 'm.lopez@acmecorp.com',
    fechaAgregado: '05 Nov 2023',
    rol: 'Contador',
    estado: 'Activo',
    iniciales: 'ML',
    color: '#ec4899',
  },
  {
    id: '3',
    nombre: 'Roberto Chávez',
    email: 'r.chavez@acmecorp.com',
    fechaAgregado: '23 Dic 2023',
    rol: 'Empleado',
    estado: 'Pendiente',
    iniciales: 'RC',
    color: '#f59e0b',
  },
  {
    id: '4',
    nombre: 'Ana Martínez',
    email: 'a.martinez@acmecorp.com',
    fechaAgregado: '02 Ene 2024',
    rol: 'Empleado',
    estado: 'Desactivado',
    iniciales: 'AM',
    color: '#94a3b8',
  },
  {
    id: '5',
    nombre: 'Carlos Pérez',
    email: 'c.perez@acmecorp.com',
    fechaAgregado: '15 Feb 2024',
    rol: 'Contador',
    estado: 'Activo',
    iniciales: 'CP',
    color: '#14b8a6',
  },
];
