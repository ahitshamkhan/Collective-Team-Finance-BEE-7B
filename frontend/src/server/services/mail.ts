import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";

const smtpSchema = z.object({
  SMTP_HOST: z.literal("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().pipe(z.literal(587)),
  SMTP_USERNAME: z.email(),
  SMTP_APP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.email(),
  SMTP_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(10).default(10),
});

export type OtpMailer = (email: string, code: string) => Promise<void>;
export const sendOtp: OtpMailer = async (email, code) => {
  const parsed = smtpSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error("SMTP configuration is missing or invalid");
  const env = parsed.data;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: { user: env.SMTP_USERNAME, pass: env.SMTP_APP_PASSWORD },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    connectionTimeout: env.SMTP_TIMEOUT_SECONDS * 1000,
    greetingTimeout: env.SMTP_TIMEOUT_SECONDS * 1000,
    socketTimeout: env.SMTP_TIMEOUT_SECONDS * 1000,
  });
  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: "Collective Finance Portal verification",
      text: `Your verification code is ${code}. It expires in five minutes.`,
    });
  } finally {
    transport.close();
  }
};
