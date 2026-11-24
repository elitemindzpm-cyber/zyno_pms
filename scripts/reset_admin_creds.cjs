const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function setCredentials() {
  try {
    const password = "Mindz@007";
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const accounts = [
      {
        email: "alameenadmin@yopmail.com",
        role: "ADMIN",
        full_name: "Al Ameen Admin",
        id: "a0000000-0000-0000-0000-000000000001",
      },
      {
        email: "supeadmin@zynopms.com",
        role: "SUPER_ADMIN",
        full_name: "Super Admin",
        id: "a0000000-0000-0000-0000-000000000000",
      },
    ];

    for (const acc of accounts) {
      const meta = JSON.stringify({
        password_hash: passwordHash,
        role: acc.role,
        full_name: acc.full_name,
      });

      // Update or create in users
      const existingUser = await prisma.users.findFirst({ where: { email: acc.email } });
      if (existingUser) {
        await prisma.users.update({
          where: { id: existingUser.id },
          data: {
            role: acc.role,
            raw_user_meta_data: meta,
          },
        });
        console.log(`Updated user ${acc.email} (ID: ${existingUser.id})`);
      } else {
        await prisma.users.create({
          data: {
            id: acc.id,
            email: acc.email,
            role: acc.role,
            raw_user_meta_data: meta,
          },
        });
        console.log(`Created user ${acc.email} (ID: ${acc.id})`);
      }

      // Update or create profile
      const targetId = existingUser ? existingUser.id : acc.id;
      const existingProfile = await prisma.profiles.findFirst({ where: { id: targetId } });
      if (existingProfile) {
        await prisma.profiles.update({
          where: { id: targetId },
          data: {
            role: acc.role,
            full_name: acc.full_name,
          },
        });
        console.log(`Updated profile ${acc.email}`);
      } else {
        await prisma.profiles.create({
          data: {
            id: targetId,
            role: acc.role,
            full_name: acc.full_name,
          },
        });
        console.log(`Created profile ${acc.email}`);
      }
    }

    console.log("SUCCESS: All accounts updated with password: Mindz@007");
  } catch (err) {
    console.error("Error setting credentials:", err);
  } finally {
    await prisma.$disconnect();
  }
}

setCredentials();
