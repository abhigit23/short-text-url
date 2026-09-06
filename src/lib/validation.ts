import { z } from "zod";

export const EXPIRY_OPTIONS = ["1h", "24h", "7d", "30d", "never"] as const;
export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number];

export const MAX_CONTENT_BYTES = 1_000_000; // 1 MB
export const MAX_PASSWORD_LENGTH = 256;

export const createPasteSchema = z.object({
  content: z
    .string()
    .min(1, "content cannot be empty")
    .refine((v) => Buffer.byteLength(v, "utf8") <= MAX_CONTENT_BYTES, {
      message: `content exceeds ${MAX_CONTENT_BYTES / 1000} KB limit`,
    }),
  password: z
    .string()
    .max(MAX_PASSWORD_LENGTH, "password too long")
    .optional()
    .default(""),
  burnAfterRead: z.boolean().optional().default(false),
  expiresIn: z.enum(EXPIRY_OPTIONS).optional().default("1h"),
});

export type CreatePasteInput = z.infer<typeof createPasteSchema>;

export function htmlToText(html: string): string {
  // Basic HTML-to-text for pasted rich content; never trust raw HTML at render.
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
