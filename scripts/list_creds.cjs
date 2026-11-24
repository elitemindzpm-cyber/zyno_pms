const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.users.findMany();
    for (const u of users) {
      let meta = {};
      try { meta = JSON.parse(u.raw_user_meta_data || "{}"); } catch {}
      const test = await bcrypt.compare("Mindz@007", meta.password_hash || "");
      console.log(`Email: ${u.email} | Role: ${u.role} | Valid Mindz@007: ${test}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
