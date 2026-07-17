-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "confianza_extraccion" JSONB,
ADD COLUMN     "origen_extraccion" VARCHAR(30);
