import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolve4 } from "node:dns/promises";
import { createTransport } from "nodemailer";

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;

export interface ExamResultEmailInput {
  to: string;
  studentName: string;
  quizTitle: string;
  score: number;
  passed: boolean;
  reviewToken: string;
}

/**
 * Sends the post-exam result email (score + review link) over Gmail SMTP.
 * Configured via SMTP_USER/SMTP_APP_PASSWORD; if either is unset, the
 * service logs a warning and no-ops instead of throwing — a missing SMTP
 * config in dev/test must never block exam submission itself.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly user: string | null;
  private readonly pass: string | null;
  private readonly fromAddress: string | null;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.user = this.config.get<string>("SMTP_USER") ?? null;
    this.pass = this.config.get<string>("SMTP_APP_PASSWORD") ?? null;
    this.frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:5173";

    if (!this.user || !this.pass) {
      this.logger.warn("SMTP_USER/SMTP_APP_PASSWORD not set — result emails will be skipped.");
      this.fromAddress = null;
      return;
    }
    const fromName = this.config.get<string>("SMTP_FROM_NAME") ?? "BOHAN-PETA";
    this.fromAddress = `"${fromName}" <${this.user}>`;
  }

  /**
   * Nodemailer does its own dns.resolve4/resolve6 lookup for a hostname
   * target and can end up connecting over IPv6 even when only an IPv4
   * route is actually reachable (confirmed against the installed
   * nodemailer version's lib/shared resolveHostname logic) — Railway
   * containers have no outbound IPv6 route, so that attempt failed with
   * ENETUNREACH every time, regardless of Node's global DNS result-order
   * setting (which only affects dns.lookup, not dns.resolve4/6). Resolving
   * every concrete IPv4 address ourselves via Node's plain dns.resolve4
   * sidesteps nodemailer's own resolution entirely. Returns every address
   * found (not just the first) plus the hostname itself as a final
   * fallback, so a single unlucky/slow address doesn't take down every
   * send — the caller tries each in order until one connects.
   */
  private async resolveGmailHosts(): Promise<string[]> {
    try {
      const ips = await resolve4(GMAIL_SMTP_HOST);
      if (ips.length > 0) return [...ips, GMAIL_SMTP_HOST];
    } catch (err) {
      this.logger.warn(`Could not resolve ${GMAIL_SMTP_HOST} to an IPv4 address: ${(err as Error).message}`);
    }
    return [GMAIL_SMTP_HOST];
  }

  async sendExamResultEmail(input: ExamResultEmailInput): Promise<void> {
    if (!this.user || !this.pass || !this.fromAddress) return;

    const reviewUrl = `${this.frontendUrl}/review/${input.reviewToken}`;
    const resultText = input.passed ? "עברת את הבוחן" : "לא עברת את הבוחן";
    const displayScore = Math.round(input.score);
    const mail = {
      from: this.fromAddress,
      to: input.to,
      subject: `התוצאה שלך בבוחן: ${input.quizTitle}`,
      text: [
        `שלום ${input.studentName},`,
        "",
        `הבוחן "${input.quizTitle}" הוגש בהצלחה.`,
        `הציון שלך: ${displayScore}%`,
        resultText,
        "",
        `לסקירת התשובות שלך: ${reviewUrl}`,
      ].join("\n"),
      html: `
        <div dir="rtl" style="font-family: sans-serif;">
          <p>שלום ${input.studentName},</p>
          <p>הבוחן "${input.quizTitle}" הוגש בהצלחה.</p>
          <p>הציון שלך: <strong>${displayScore}%</strong><br />${resultText}</p>
          <p><a href="${reviewUrl}">לסקירת התשובות שלך</a></p>
        </div>
      `,
    };

    const hosts = await this.resolveGmailHosts();
    let lastError: Error | null = null;
    for (const host of hosts) {
      try {
        const transporter = createTransport({
          host,
          port: GMAIL_SMTP_PORT,
          secure: true,
          connectionTimeout: 10_000,
          auth: { user: this.user, pass: this.pass },
          // Connecting via a bare IP skips SNI/hostname derivation, so the
          // server cert (issued for smtp.gmail.com) would otherwise fail
          // hostname verification — pin it back explicitly.
          tls: { servername: GMAIL_SMTP_HOST },
        });
        await transporter.sendMail(mail);
        return;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Send via ${host} failed, ${host === hosts[hosts.length - 1] ? "no more addresses to try" : "trying next address"}: ${lastError.message}`);
      }
    }
    this.logger.error(`Failed to send result email to ${input.to} after trying ${hosts.length} address(es): ${lastError?.message}`);
  }
}
