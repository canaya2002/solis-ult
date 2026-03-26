// SOLIS AI — Database seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed competitors
  const competitors = [
    {
      name: "Abogados de Inmigración García",
      domain: "garciaimmigration.com",
      city: "Dallas",
      notes: "Competidor principal en Dallas",
    },
    {
      name: "Immigration Law Group",
      domain: "ilgrouplaw.com",
      city: "Chicago",
      notes: "Principal competidor en Chicago",
    },
    {
      name: "LA Immigration Attorneys",
      domain: "laimmigration.com",
      city: "Los Angeles",
      notes: "Competidor fuerte en LA",
    },
    {
      name: "Memphis Immigration Legal",
      domain: "memphisimmigrationlegal.com",
      city: "Memphis",
      notes: "Competidor local en Memphis",
    },
    {
      name: "Texas Immigration Lawyers",
      domain: "texasimmigrationlaw.com",
      city: "Dallas",
      notes: "Competidor con presencia estatal en Texas",
    },
  ];

  for (const comp of competitors) {
    await prisma.competitor.upsert({
      where: { id: comp.domain }, // Will fail on first run, handled by create
      update: comp,
      create: comp,
    });
  }

  console.log(`Seeded ${competitors.length} competitors`);

  // Seed a sample admin user (password: admin123 — change in production)
  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@manuelsolis.com" },
    update: {},
    create: {
      email: "admin@manuelsolis.com",
      name: "Admin SOLIS AI",
      hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("Seeded admin user: admin@manuelsolis.com / admin123");
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
