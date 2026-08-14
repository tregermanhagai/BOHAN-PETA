import path from "node:path";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

// quiet: true suppresses dotenv's own randomized promotional console
// tips on every load (a real, if unwelcome, feature of the package —
// see node_modules/dotenv/lib/main.js's TIPS array).
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

// Imported after dotenv.config() so DATABASE_URL is already in process.env
// by the time prisma.service-style adapter construction below reads it.
import * as bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma";

const SALT_ROUNDS = 10;

/**
 * v1.0 has exactly two roles (Student, Teacher/Course-Admin) — see PRD
 * section 2's scope note; there's no separate "Super Admin" flag on the
 * Teacher model yet, deliberately, since that's out of scope until there's
 * more than one teacher's org to manage. This seeds a Teacher account,
 * which *is* the admin role for v1.0 (full control over their own
 * cohorts/quizzes/scores).
 */
const ADMIN_EMAIL = "hagai.tregerman@gmail.com";
const ADMIN_NAME = "Hagai Tregerman";

function generatePassword(): string {
  return randomBytes(18).toString("base64url"); // 24 chars, URL-safe
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const suppliedPassword = process.env.SEED_ADMIN_PASSWORD;
  const password = suppliedPassword ?? generatePassword();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const existing = await prisma.teacher.findUnique({ where: { email: ADMIN_EMAIL } });

  await prisma.teacher.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, passwordHash },
    create: { name: ADMIN_NAME, email: ADMIN_EMAIL, passwordHash },
  });

  await prisma.$disconnect();

  console.log(`\n${existing ? "Updated" : "Created"} teacher/admin account:`);
  console.log(`  email: ${ADMIN_EMAIL}`);
  if (!suppliedPassword) {
    console.log(`  password: ${password}`);
    console.log(
      "\n  This password was generated because SEED_ADMIN_PASSWORD wasn't set.\n" +
        "  It is NOT stored anywhere in plaintext — copy it now, or set\n" +
        "  SEED_ADMIN_PASSWORD in apps/api/.env and re-run to choose your own.\n",
    );
  } else {
    console.log("  password: (the value you set in SEED_ADMIN_PASSWORD)\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
