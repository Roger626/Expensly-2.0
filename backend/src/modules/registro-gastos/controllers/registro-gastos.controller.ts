import { Controller, Post, Body, Get, Param, Delete, HttpCode, HttpStatus, UseInterceptors, ClassSerializerInterceptor, Put, Patch, UseGuards, ParseUUIDPipe, Inject, Res, Query } from '@nestjs/common';
import { UploadedFiles, ParseFilePipe, FileTypeValidator, MaxFileSizeValidator } from '@nestjs/common';
import { CreateFacturaDto, UpdateFacturaDto, ExportInvoicesDto } from '../dto/factura.dto';
import { FacturaEntity } from '../entities/factura.entity';
import { RegistroGastosService } from '../services/registro-gastos.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from 'src/modules/auth/decorators/current-user.decorator';
import { FacturaProcesamientoResult } from '../strategies/factura-procesar.strategy.interface';
import { IExportStrategy } from '../interfaces/export-strategy.interface';
import { EXPORT_STRATEGY } from '../registro-gastos.tokens';
import { Response } from 'express';

@Controller("registro-gastos")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class RegistroGastosController {
    constructor(
        private readonly registroGastosService: RegistroGastosService,
        @Inject(EXPORT_STRATEGY) private readonly exportStrategy: IExportStrategy,
    ) {}

    //===================== PROCESAMIENTO DE FACTURA (OCR) & QR =====================

    @Post("procesar-factura")
    @UseInterceptors(FilesInterceptor('files', 10))
    @HttpCode(HttpStatus.OK)
    async invoiceProcessing(
        @UploadedFiles(
            new ParseFilePipe({
                validators: [
                    new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
                    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
                ],
            })
        )
        files: Express.Multer.File[],
        @Body('clientQrData') clientQrData?: string,
    ): Promise<any> { // Use 'any' or explicit interface to bypass strict class serialization issues

        if (!files || files.length === 0) {
            throw new Error('Debe subir al menos una imagen de la factura.');
        }

        const buffers = files.map(f => f.buffer);
        const result  = await this.registroGastosService.processInvoice(buffers, clientQrData || undefined);

        return {
            message: `Factura procesada exitosamente (${files.length} imagen${files.length > 1 ? 'es' : ''})`,
            data:    result,
        };
    }

    //===================== CRUD Factura =====================

    @Get()
    @HttpCode(HttpStatus.OK)
    async getAllFacturas(@CurrentUser() user: CurrentUserPayload): Promise<FacturaEntity[]> {
        const facturas: FacturaEntity[] = await this.registroGastosService.getAllFacturas(user.organizationId);
        return facturas.map(f => new FacturaEntity(f));
    }

    @Get('mis-facturas')
    @HttpCode(HttpStatus.OK)
    async getMisFacturas(@CurrentUser() user: CurrentUserPayload): Promise<FacturaEntity[]> {
        const facturas = await this.registroGastosService.getFacturasByUsuario(user.userId);
        return facturas.map(f => new FacturaEntity(f));
    }

    @Get('dashboard/resumen')
    @Roles('SUPERADMIN', 'CONTADOR')
    @HttpCode(HttpStatus.OK)
    async getDashboardResumen(
        @CurrentUser() user: CurrentUserPayload,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('categoriaId') categoriaId?: string,
        @Query('usuarioId') usuarioId?: string,
    ): Promise<any> {
        return await this.registroGastosService.getDashboardResumen(
            user.organizationId,
            startDate,
            endDate,
            categoriaId,
            usuarioId,
        );
    }

    @Get('dashboard/tendencia-mensual')
    @Roles('SUPERADMIN', 'CONTADOR')
    @HttpCode(HttpStatus.OK)
    async getDashboardTendencia(
        @CurrentUser() user: CurrentUserPayload,
        @Query('categoriaId') categoriaId?: string,
        @Query('usuarioId') usuarioId?: string,
    ): Promise<any> {
        return await this.registroGastosService.getDashboardTendencia(
            user.organizationId,
            categoriaId,
            usuarioId,
        );
    }

    @Get('dashboard/categorias')
    @Roles('SUPERADMIN', 'CONTADOR')
    @HttpCode(HttpStatus.OK)
    async getDashboardCategorias(
        @CurrentUser() user: CurrentUserPayload,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('usuarioId') usuarioId?: string,
    ): Promise<any> {
        return await this.registroGastosService.getDashboardCategorias(
            user.organizationId,
            startDate,
            endDate,
            usuarioId,
        );
    }

    @Get(":id")
    @HttpCode(HttpStatus.OK)
    async getFacturaById(
        @Param("id", ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
    ): Promise<FacturaEntity>{
        const factura: FacturaEntity = await this.registroGastosService.getFacturaById(id, user.organizationId);
        return new FacturaEntity(factura);
    }

    @Post("create")
    @HttpCode(HttpStatus.CREATED)
    async createFactura(
        @CurrentUser() user: CurrentUserPayload,
        @Body() dto: CreateFacturaDto,
    ): Promise<FacturaEntity>{
        const organizacionId = user.organizationId;
        const factura: FacturaEntity = await this.registroGastosService.createFactura(organizacionId, user.userId, dto);
        return new FacturaEntity(factura);
    }

    @Patch(':id/update-mine')
    @HttpCode(HttpStatus.OK)
    async updateFacturaMine(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
        @Body() dto: UpdateFacturaDto,
    ): Promise<FacturaEntity> {
        const factura = await this.registroGastosService.updateFacturaMine(id, user.userId, dto);
        return new FacturaEntity(factura);
    }

    @Delete(':id/delete-mine')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteFacturaMine(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
    ): Promise<void> {
        await this.registroGastosService.deleteFacturaMine(id, user.userId);
    }

    @Put("update/:id")
    @Roles("SUPERADMIN", "CONTADOR")
    @HttpCode(HttpStatus.OK)
    async updateFactura(
        @Param("id", ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
        @Body() dto: UpdateFacturaDto,
    ): Promise<FacturaEntity> {
        const factura: FacturaEntity = await this.registroGastosService.updateFactura(id, user.organizationId, dto);
        return new FacturaEntity(factura);
    }

    @Delete("delete/:id")
    @Roles("SUPERADMIN", "CONTADOR")
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteFactura(
        @Param("id", ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
    ): Promise<boolean> {
        return await this.registroGastosService.deleteFactura(id, user.organizationId);
    }

    //===================== EXPORTACIÓN =====================

    @Post("export")
    @Roles("SUPERADMIN", "CONTADOR")
    @HttpCode(HttpStatus.OK)
    async exportFacturas(
        @Body() dto: ExportInvoicesDto,
        @CurrentUser() user: CurrentUserPayload,
        @Res() res: Response,
    ): Promise<void> {
        const buffer = await this.exportStrategy.export(dto.ids, user.organizationId);

        const filename = `facturas_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length,
        });

        res.end(buffer);
    }

}
