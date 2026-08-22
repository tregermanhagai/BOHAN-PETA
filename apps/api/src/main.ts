import "reflect-metadata";
import { setDefaultResultOrder } from "node:dns";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

// Some hosts (e.g. Railway) have no outbound IPv6 route, but Node's default
// DNS resolution can still return/prefer a dual-stack host's IPv6 address
// (Gmail's SMTP server does) — unlike browsers, plain net/tls connections
// don't fall back to IPv4 when that fails, so every send attempt died with
// ENETUNREACH. Preferring IPv4 first avoids ever trying the unreachable
// address in the first place.
setDefaultResultOrder("ipv4first");

const INSECURE_DEFAULT_JWT_SECRET = "dev-only-insecure-secret";

/**
 * Fails loudly at boot rather than silently serving traffic with a
 * guessable JWT secret — a misconfigured production deploy (missing env
 * var) should crash immediately, not quietly issue forgeable tokens.
 * Dev/test are exempt since they intentionally rely on the fallback.
 */
function assertJwtSecretConfigured(): void {
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.JWT_SECRET;
  if (isProd && (!secret || secret === INSECURE_DEFAULT_JWT_SECRET)) {
    throw new Error(
      "JWT_SECRET is not set (or is still the insecure dev default) with NODE_ENV=production. " +
        "Set a real, random JWT_SECRET before starting the app.",
    );
  }
}

/**
 * CORS_ORIGIN (comma-separated) restricts requests to known frontend
 * origins in production. Left unset, CORS stays wide open — the
 * permissive default local dev has always used.
 */
function resolveCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return true;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  assertJwtSecretConfigured();

  const app = await NestFactory.create(AppModule, { cors: { origin: resolveCorsOrigin() } });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`BOHAN-PETA API listening on http://localhost:${port}`);
}

bootstrap();
