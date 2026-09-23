import {z} from "zod";

const nullableEmail = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().email().max(254).transform((value) => value.toLowerCase()).nullable().optional(),
).transform((value) => value ?? null);

export function normalizeWhatsapp(value: string): string {
  const compact = value.replace(/[ ()-]/g, "").replace(/^\+/, "");
  return compact.startsWith("0") ? `62${compact.slice(1)}` : compact;
}

const nullableWhatsapp = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(32).regex(/^\+?[0-9][0-9 ()-]*$/).transform(normalizeWhatsapp).refine((value) => /^[1-9]\d{6,14}$/.test(value), "Invalid WhatsApp number").nullable().optional(),
).transform((value) => value ?? null);

const nullableText = (max: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable().optional(),
).transform((value) => value ?? null);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Invalid event date");

const contactSchema = z.object({
  submissionKey: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: nullableEmail,
  whatsapp: nullableWhatsapp,
  eventType: z.enum(["wedding", "events", "other"]),
  eventDate: nullableText(10).refine((value) => value === null || isoDate.safeParse(value).success, "Invalid event date"),
  eventLocation: nullableText(200),
  message: z.string().trim().min(1).max(5000),
}).superRefine((value, context) => {
  if (!value.email && !value.whatsapp) {
    context.addIssue({code: "custom", path: ["email"], message: "Email or WhatsApp is required"});
  }
});

export type ContactInput = z.infer<typeof contactSchema>;

export function parseContactInput(raw: unknown): {ok: true; value: ContactInput} | {ok: false; kind: "validation"; fieldErrors: Record<string, string[]>} {
  const result = contactSchema.safeParse(raw);
  if (result.success) return {ok: true, value: result.data};

  const fieldErrors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(result.error.flatten().fieldErrors)) {
    fieldErrors[field] = messages ?? [];
  }
  return {ok: false, kind: "validation", fieldErrors};
}
