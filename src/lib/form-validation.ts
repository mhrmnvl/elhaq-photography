import {z} from "zod";

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

export function validateWithZod<T>(
  schema: z.ZodType<T>,
  data: unknown
): {ok: true; data: T} | {ok: false; errors: Record<string, string>} {
  const result = schema.safeParse(data);
  if (result.success) {
    return {ok: true, data: result.data};
  }
  return {ok: false, errors: formatZodErrors(result.error)};
}

// 1. Private Link Form Schema
export const privateLinkFormSchema = z.object({
  albumName: z
    .string()
    .trim()
    .min(1, "Album name is required")
    .max(200, "Album name must be 200 characters or fewer"),
  driveUrl: z
    .string()
    .trim()
    .min(1, "Google Drive link is required")
    .url("Enter a valid URL")
    .refine((url) => /^https:\/\/drive\.google\.com\//.test(url), {
      message: "Must be a Google Drive link (https://drive.google.com/...)",
    }),
});

export type PrivateLinkFormData = z.infer<typeof privateLinkFormSchema>;

// 2. Album Editor Form Schema
export const albumEditorSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120, "Slug must be 120 characters or fewer")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must use lowercase letters, numbers, and hyphens (e.g. wedding-story)"
    ),
  category: z.enum(["wedding", "events", "other"]),
  title: z.object({
    en: z
      .string()
      .trim()
      .min(1, "English title is required")
      .max(160, "English title must be 160 characters or fewer"),
    id: z
      .string()
      .trim()
      .min(1, "Indonesian title is required")
      .max(160, "Indonesian title must be 160 characters or fewer"),
  }),
  story: z.object({
    en: z
      .string()
      .trim()
      .min(1, "English story is required")
      .max(5000, "English story must be 5000 characters or fewer"),
    id: z
      .string()
      .trim()
      .min(1, "Indonesian story is required")
      .max(5000, "Indonesian story must be 5000 characters or fewer"),
  }),
  sortOrder: z
    .number({error: "Display order must be a number"})
    .int("Display order must be an integer")
    .min(0, "Display order must be 0 or greater")
    .max(10000, "Display order must be 10000 or fewer"),
  photos: z.array(
    z.object({
      mediaId: z.string(),
      position: z.number(),
      alt: z.object({
        en: z.string().trim().min(1, "English alt text is required"),
        id: z.string().trim().min(1, "Indonesian alt text is required"),
      }),
    })
  ),
});

export type AlbumEditorFormData = z.infer<typeof albumEditorSchema>;
