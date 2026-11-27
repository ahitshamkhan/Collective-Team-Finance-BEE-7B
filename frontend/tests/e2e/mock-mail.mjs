// Loaded only by the isolated browser test server, never by the application.
if (process.env.APP_ENV !== "test" || !process.env.PORTAL_TEST_MAILBOX) {
  throw new Error("Mock SMTP requires the isolated test runner");
}
import fs from "node:fs";
import nodemailer from "nodemailer";
nodemailer.createTransport = () => ({
  async sendMail(message) {
    fs.appendFileSync(
      process.env.PORTAL_TEST_MAILBOX,
      JSON.stringify({ to: message.to, text: message.text }) + "\n",
    );
    return { accepted: [message.to] };
  },
  close() {},
});
