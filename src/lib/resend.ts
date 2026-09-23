import {getServerEnv} from "@/lib/env";
import type {ContactMailer} from "@/server/contact";

export function getContactMailer(): ContactMailer | null {
  const env = getServerEnv();
  if (!env.RESEND_ENABLED) return null;

  return {
    async send(input) {
      if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.OWNER_EMAIL) {
        throw new Error("RESEND_CONFIGURATION_MISSING");
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          to: [env.OWNER_EMAIL],
          subject: `New ${input.eventType} enquiry`,
          text: [
            `Name: ${input.name}`,
            `Email: ${input.email ?? "-"}`,
            `WhatsApp: ${input.whatsapp ?? "-"}`,
            `Event date: ${input.eventDate ?? "-"}`,
            `Event location: ${input.eventLocation ?? "-"}`,
            "",
            input.message,
          ].join("\n"),
          ...(input.replyTo ? {reply_to: input.replyTo} : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json() as {id?: unknown; message?: unknown};
      if (!response.ok || typeof body.id !== "string") {
        throw new Error(typeof body.message === "string" ? body.message : "RESEND_REQUEST_FAILED");
      }
      return {providerId: body.id};
    },
  };
}
