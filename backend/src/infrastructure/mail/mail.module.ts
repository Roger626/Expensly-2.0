import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { checkServerIdentity, type PeerCertificate } from 'tls';

// Brevo hace DNS round-robin entre varios POPs regionales, y cada uno sirve
// un certificado con un juego de SANs distinto: unos aún usan los nombres
// legacy de Sendinblue, otros ya usan nombres de Brevo. Ningún hostname fijo
// hace match con ambos, así que probamos el chequeo de identidad estándar de
// Node contra cada nombre legítimo conocido y aceptamos si alguno matchea.
// La validación de la cadena de confianza (CA, expiración, firma) NO se toca:
// solo se sustituye el paso de comparación de hostname.
const BREVO_KNOWN_HOSTNAMES = ['smtp-relay.brevo.com', 'smtp-relay.sendinblue.com'];

function checkBrevoServerIdentity(hostname: string, cert: PeerCertificate): Error | undefined {
  for (const knownHostname of BREVO_KNOWN_HOSTNAMES) {
    if (!checkServerIdentity(knownHostname, cert)) {
      return undefined;
    }
  }
  return checkServerIdentity(hostname, cert);
}

/**
 * MailModule
 * Configura el transporte SMTP usando Brevo (smtp-relay.brevo.com).
 *
 * Por qué Brevo y no Gmail:
 *   Gmail bloquea conexiones SMTP desde rangos de IP de cloud providers
 *   (Render, AWS, GCP, etc.) para prevenir spam. Brevo es un relay SMTP
 *   profesional que acepta conexiones desde cualquier IP y es gratis hasta
 *   300 emails/día.
 *
 * Variables de entorno necesarias:
 *   BREVO_USER  →  tu email de cuenta Brevo (ej. roger@gmail.com)
 *   BREVO_PASS  →  SMTP key generada en Brevo (NO tu contraseña de Brevo)
 *                  Brevo Dashboard → SMTP & API → SMTP → Generate a new SMTP key
 *   MAIL_FROM   →  dirección de envío (ej. "Expensly <noreply@expensly.com>")
 */
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: 'smtp-relay.brevo.com',
          port: 2525,
          secure: false,        // STARTTLS en puerto 2525
          tls: {
            checkServerIdentity: checkBrevoServerIdentity,
          },
          auth: {
            user: config.get<string>('BREVO_USER'),
            pass: config.get<string>('BREVO_PASS'),
          },
        },
        defaults: {
          from: config.get<string>('MAIL_FROM') ?? `"Expensly" <${config.get<string>('BREVO_USER')}>`,
        },
      }),
    }),
  ],
  exports: [MailerModule],
})
export class MailModule {}
