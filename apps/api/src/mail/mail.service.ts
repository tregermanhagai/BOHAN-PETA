import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";

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
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | null;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_APP_PASSWORD");
    this.frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:5173";

    if (!user || !pass) {
      this.logger.warn("SMTP_USER/SMTP_APP_PASSWORD not set — result emails will be skipped.");
      this.transporter = null;
      this.fromAddress = null;
      return;
    }
    const fromName = this.config.get<string>("SMTP_FROM_NAME") ?? "BOHAN-PETA";
    this.fromAddress = `"${fromName}" <${user}>`;
    this.transporter = createTransport({ service: "gmail", auth: { user, pass } });
  }

  async sendExamResultEmail(input: ExamResultEmailInput): Promise<void> {
    if (!this.transporter || !this.fromAddress) return;

    const reviewUrl = `${this.frontendUrl}/review/${input.reviewToken}`;
    const resultText = input.passed ? "עברת את הבוחן" : "לא עברת את הבוחן";

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: `התוצאה שלך בבוחן: ${input.quizTitle}`,
        text: [
          `שלום ${input.studentName},`,
          "",
          `הבוחן "${input.quizTitle}" הוגש בהצלחה.`,
          `הציון שלך: ${input.score}%`,
          resultText,
          "",
          `לסקירת התשובות שלך: ${reviewUrl}`,
        ].join("\n"),
        html: `
          <div dir="rtl" style="font-family: sans-serif;">
            <p>שלום ${input.studentName},</p>
            <p>הבוחן "${input.quizTitle}" הוגש בהצלחה.</p>
            <p>הציון שלך: <strong>${input.score}%</strong><br />${resultText}</p>
            <p><a href="${reviewUrl}">לסקירת התשובות שלך</a></p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send result email to ${input.to}: ${(err as Error).message}`);
    }
  }
}
