import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("Captain Ayman"),
  /** Secret for encrypting the site access code and signing access cookies (≥ 32 chars). Required in production. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
  /** Enables /setup (first coach account + recovery). Keep it secret; remove it to disable the page. */
  ADMIN_KEY: z.string().min(16, "ADMIN_KEY must be at least 16 characters").optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CRON_SECRET: z.string().optional(),
  TRUST_PROXY: bool,
  STORAGE_DRIVER: z.enum(["database", "local", "s3"]).default("database"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool,
  MAX_UPLOAD_MB: z.coerce.number().min(1).max(50).default(10),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Lazily validated server environment (never import from client components). */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment configuration — ${issues}`);
    }
    if (parsed.data.NODE_ENV === "production" && !parsed.data.AUTH_SECRET) {
      throw new Error("Invalid environment configuration — AUTH_SECRET is required in production (openssl rand -hex 32)");
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProd = () => process.env.NODE_ENV === "production";
