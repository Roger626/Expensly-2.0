-- AlterTable
ALTER TABLE "organizaciones" ADD COLUMN     "trial_inicia_en" TIMESTAMPTZ(6),
ADD COLUMN     "trial_termina_en" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" UUID NOT NULL,
    "organizacion_id" UUID NOT NULL,
    "plan" VARCHAR(50) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'Trial',
    "card_token" VARCHAR(255),
    "display_num" VARCHAR(4),
    "current_period_end" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "dunning_step" INTEGER NOT NULL DEFAULT 0,
    "last_dunning_at" TIMESTAMPTZ(6),
    "last_cron_at" TIMESTAMPTZ(6),
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "suscripcion_id" UUID NOT NULL,
    "cod_oper" VARCHAR(100) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "operation_type" VARCHAR(30) NOT NULL,
    "raw_payload" JSONB,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_organizacion_id_key" ON "suscripciones"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_cod_oper_key" ON "pagos"("cod_oper");

-- CreateIndex
CREATE INDEX "pagos_suscripcion_id_fecha_idx" ON "pagos"("suscripcion_id", "fecha");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_suscripcion_id_fkey" FOREIGN KEY ("suscripcion_id") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
