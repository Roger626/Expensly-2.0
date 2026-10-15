#!/usr/bin/env bash
# Crea una organización demo con usuarios y facturas para probar el dashboard en local.
# Requiere: backend corriendo (API_URL) y el contenedor de postgres del docker-compose.
# Uso: bash scripts/seed-demo.sh
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api}"
PG="docker exec -i expensly-postgres-1 psql -U expensly -d expensly -v ON_ERROR_STOP=1 -q"

# Credenciales SOLO de prueba local
ADMIN_EMAIL="demo.admin@expensly.test"
ADMIN_PASS="DemoExpensly2026!"
CONTADOR_EMAIL="demo.contador@expensly.test"
EMPLEADO_EMAIL="demo.empleado@expensly.test"
EMPLEADO2_EMAIL="demo.ventas@expensly.test"

echo "→ Onboarding de la organización demo"
curl -sf -X POST "$API_URL/auth/onboarding" -H 'Content-Type: application/json' -d "{
  \"company\": { \"razonSocial\": \"Distribuidora Demo, S.A.\", \"ruc\": \"155600001-2-2020\", \"dv\": \"45\", \"subscripcion\": \"pro\" },
  \"admin\":   { \"name\": \"Ana Demo\", \"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASS\" }
}" >/dev/null || echo "  (ya existía)"

ORG=$($PG -tA -c "select organizacion_id from usuarios where email='$ADMIN_EMAIL'")
HASH=$($PG -tA -c "select password_hash from usuarios where email='$ADMIN_EMAIL'")

echo "→ Usuarios, categorías y facturas"
$PG <<SQL
insert into usuarios (id, organizacion_id, nombre_completo, email, password_hash, rol)
values
  (gen_random_uuid(), '$ORG', 'Carlos Contador', '$CONTADOR_EMAIL', '$HASH', 'CONTADOR'),
  (gen_random_uuid(), '$ORG', 'Elena Ríos',      '$EMPLEADO_EMAIL', '$HASH', 'EMPLEADO'),
  (gen_random_uuid(), '$ORG', 'Mario Batista',   '$EMPLEADO2_EMAIL', '$HASH', 'EMPLEADO')
on conflict (email) do nothing;

insert into categorias (id, organizacion_id, nombre, codigo_contable)
select gen_random_uuid(), '$ORG', n, c
from (values ('Alimentación','6101'),('Transporte','6102'),('Combustible','6103'),
             ('Hospedaje','6104'),('Suministros de oficina','6105'),('Tecnología','6106')) v(n, c)
where not exists (select 1 from categorias where organizacion_id='$ORG' and nombre=v.n);

-- 90 facturas en los últimos 6 meses
delete from facturas where organizacion_id='$ORG';
insert into facturas (id, organizacion_id, usuario_id, categoria_id, monto_total, itbms, subtotal,
                      fecha_emision, ruc_proveedor, dv_proveedor, nombre_proveedor, numero_factura,
                      cufe, estado, motivo_rechazo, origen_extraccion, fecha_subida)
select gen_random_uuid(), '$ORG', u.id, c.id,
       round((sub * 1.07)::numeric, 2), round((sub * 0.07)::numeric, 2), round(sub::numeric, 2),
       d, p.ruc, p.dv, p.nombre, lpad((1000 + g)::text, 8, '0'),
       case when g % 4 <> 0 then 'FE01200001' || p.ruc || lpad(g::text, 30, '0') end,
       case when g % 7 = 0 then 'RECHAZADO' when g % 3 = 0 then 'PENDIENTE' else 'APROBADO' end,
       case when g % 7 = 0 then 'Factura duplicada o sin respaldo legible' end,
       case when g % 4 <> 0 then 'QR_DGI' else 'OCR_LLM' end,
       d + interval '9 hours'
from generate_series(1, 90) g
cross join lateral (select (current_date - ((g * 37) % 180))::date d, 8 + ((g * 53) % 240) + (g % 10) * 0.37 sub) x
cross join lateral (select id from usuarios where organizacion_id='$ORG' and rol='EMPLEADO' order by email offset (g % 2) limit 1) u
cross join lateral (select id from categorias where organizacion_id='$ORG' order by nombre offset (g % 6) limit 1) c
cross join lateral (select * from (values
    ('155704412-2-2021','31','Farmacia Las Cumbres'),('8-742-1190','05','Ferretería El Puente'),
    ('155612345-2-2019','12','Super Mercado La Nacional'),('155698765-1-2018','77','Hotel Bahía Azul'),
    ('155611111-2-2022','08','Estación Delta Vía España'),('155622222-1-2017','64','Copias y Más')
  ) p(ruc, dv, nombre) offset (g % 6) limit 1) p;
SQL

echo "✓ Listo. Admin: $ADMIN_EMAIL (contraseña en este script). Contador/empleados usan la misma."
