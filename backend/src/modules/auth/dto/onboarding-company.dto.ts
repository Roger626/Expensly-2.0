import { IsString, IsNotEmpty, IsOptional, IsIn, MinLength, MaxLength, IsEmail, IsUUID } from 'class-validator';

export class OnboardingCompanyDto {
    @IsString()
    @IsNotEmpty({message: "El nombre de la empresa es obligatorio"})
    @MinLength(1)
    @MaxLength(255)
    razonSocial: string;

    @IsString()
    @IsNotEmpty({message: "El RUC es obligatorio"})
    @MinLength(1)
    @MaxLength(50)
    ruc: string;

    @IsString()
    @IsNotEmpty({message: "El dígito verificador es obligatorio"})
    @MinLength(1)
    @MaxLength(2)
    dv: string;

    // NOTE: The field is spelled "subscripcion" (correct spelling).
    // The "subscriocion" typo on UpdateCompanyDto:55 is intentionally kept for backward compat.
    @IsString()
    @IsOptional()
    @IsIn(['basic', 'pro', 'premium'], { message: 'El plan debe ser basic, pro o premium' })
    @MaxLength(50)
    subscripcion?: string | null;

}

export class UpdateCompanyDto {
    @IsUUID()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(255)
    razonSocial?: string | null;

    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(50)
    ruc?: string | null;

    @IsString()
    @IsOptional()
    @MinLength(1)
    @MaxLength(2)
    dv?: string | null;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    subscriocion?: string | null;

  
}