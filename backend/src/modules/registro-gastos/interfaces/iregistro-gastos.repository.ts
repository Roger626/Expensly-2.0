import { CreateFacturaDto, UpdateFacturaDto } from "../dto/factura.dto";
import { FacturaEntity } from "../entities/factura.entity";
    

export interface IRegistroGastosRepository {
    getAllFacturas(organizacionId: string): Promise<FacturaEntity[]>;
    getFacturasByUsuario(userId: string): Promise<FacturaEntity[]>;
    getFacturaById(id: string, organizacionId: string): Promise<FacturaEntity>;
    updateFacturaMine(id: string, userId: string, dto: UpdateFacturaDto): Promise<FacturaEntity>;
    deleteFacturaMine(id: string, userId: string): Promise<boolean>;
    createFactura(organizacionId: string, usuarioId: string, dto: CreateFacturaDto): Promise<FacturaEntity>;
    updateFactura(id: string, dto: UpdateFacturaDto, organizacionId: string): Promise<FacturaEntity>;
    deleteFactura(id: string, organizacionId: string): Promise<boolean>;
    invoiceExists(organizacionId: string, numFactura: string, rucProveedor: string, cufe: string): Promise<boolean>;
    getDashboardResumen(orgId: string, start: Date, end: Date, catId?: string, empId?: string): Promise<any>;
    getDashboardTendencia(orgId: string, catId?: string, empId?: string, start?: Date, end?: Date): Promise<any>;
    getDashboardCategorias(orgId: string, start: Date, end: Date, empId?: string): Promise<any>;
}