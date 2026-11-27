import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));
import { otpHmac, equalBytes, digestFlow } from "../src/server/services/otp";
import { sendOtp } from "../src/server/services/mail";

beforeEach(() => {
  vi.stubEnv("OTP_HMAC_KEY", "o".repeat(32));
  vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USERNAME", "synthetic@example.test");
  vi.stubEnv("SMTP_FROM", "synthetic@example.test");
  vi.stubEnv("SMTP_APP_PASSWORD", "synthetic-only");
  mocks.createTransport.mockReturnValue({
    sendMail: mocks.sendMail,
    close: mocks.close,
  });
  mocks.sendMail.mockReset().mockResolvedValue({});
  mocks.close.mockClear();
});
describe("Module 11 crypto and mock SMTP", () => {
  it("binds a code to its challenge, purpose and generation", () => {
    const original = otpHmac("a", "registration", 1, "000001");
    for (const other of [
      otpHmac("b", "registration", 1, "000001"),
      otpHmac("a", "recovery", 1, "000001"),
      otpHmac("a", "registration", 2, "000001"),
      otpHmac("a", "registration", 1, "000002"),
    ])
      expect(equalBytes(original, other)).toBe(false);
    expect(
      equalBytes(original, otpHmac("a", "registration", 1, "000001")),
    ).toBe(true);
    expect(equalBytes(original, Buffer.alloc(0))).toBe(false);
  });
  it("hashes flow secrets", () =>
    expect(digestFlow("secret")).toHaveLength(32));
  it("uses mandatory STARTTLS and bounded timeouts", async () => {
    await sendOtp("member@example.test", "000001");
    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        requireTLS: true,
        port: 587,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
      }),
    );
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "member@example.test",
        text: expect.stringContaining("000001"),
      }),
    );
    expect(mocks.close).toHaveBeenCalled();
  });
  it("closes transport on failure", async () => {
    mocks.sendMail.mockRejectedValue(new Error("synthetic failure"));
    await expect(sendOtp("member@example.test", "000001")).rejects.toThrow();
    expect(mocks.close).toHaveBeenCalled();
  });
  it("rejects unsupported SMTP configuration", async () => {
    vi.stubEnv("SMTP_HOST", "untrusted.example.test");
    await expect(sendOtp("member@example.test", "000001")).rejects.toThrow(
      "SMTP configuration",
    );
  });
});
