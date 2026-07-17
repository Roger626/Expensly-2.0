import { IsString, IsNumber, IsDateString, IsOptional, Min, IsUUID, IsNotEmpty, IsUrl, IsEnum, ValidateNested, IsArray, IsObject } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { EstadoFactura } from "../../../../generated/prisma/enums";
import { Type } from 'class-transformer';


// Definimos la estructura de cada imagen
class ImagenFacturaDto {
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  publicId: string;
}
export class CreateFacturaDto {

    @IsUUID()
    @IsNotEmpty()
    categoriaId: string;

    @IsNumber()
    @Min(0.01)
    @IsNotEmpty()
    monto: number;

    @IsNumber()
    @Min(0.00)
    @IsOptional()
    impuesto?: number;

    @IsNumber()
    @Min(0.00)
    @IsOptional()
    subtotal?: number;

    @IsDateString()
    @IsNotEmpty()
    fechaEmision: string;

    @IsNotEmpty()
    @IsString()
    rucProveedor: string;

    @IsOptional()
    @IsString()
    dvProveedor?: string;

    @IsNotEmpty()
    @IsString()
    nombreProveedor: string;

    @IsNotEmpty()
    @IsString()
    numeroFactura: string;

    @IsOptional()
    @IsString()
    cufe?: string;

   @IsArray()
    @ValidateNested({ each: true }) // Valida cada objeto del arreglo
    @Type(() => ImagenFacturaDto)   // Transforma el JSON al tipo de la clase
    @IsNotEmpty()
    imagenesFactura: ImagenFacturaDto[];

    @IsOptional()
    @IsString({ each: true })
    facturaTags?: string [];

    // Round-trip del resultado de /procesar-factura: el frontend recibe estos
    // valores en el form de revisión y los reenvía tal cual al crear la factura.
    @IsOptional()
    @IsString()
    origenExtraccion?: string;

    @IsOptional()
    @IsObject()
    confianzaExtraccion?: Record<string, string>;

}

export class UpdateFacturaDto extends PartialType(CreateFacturaDto) {

    @IsOptional()
    @IsEnum(EstadoFactura)
    estado?: EstadoFactura

    @IsString()
    @IsOptional()
    motivoRechazo?: string;

}

export class ExportInvoicesDto {
    @IsArray()
    @IsUUID('4', { each: true })
    @IsNotEmpty()
    ids: string[];
}