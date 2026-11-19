import prisma from '../server/lib/prisma';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seedUser() {
  try {
    const email = 'alameenadmin@yopmail.com';
    const password = 'Mindz@007';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log('Checking existing user...');
    let user = await prisma.users.findFirst({
      where: { email }
    });

    const meta = JSON.stringify({
      password_hash: passwordHash,
      role: 'ADMIN',
      full_name: 'Al Ameen Admin',
    });

    const userId = user ? user.id : 'a0000000-0000-0000-0000-000000000001';

    if (!user) {
      console.log('Creating user in users table...');
      user = await prisma.users.create({
        data: {
          id: userId,
          email: email,
          role: 'ADMIN',
          raw_user_meta_data: meta,
        }
      });
      console.log('User created:', user.id);
    } else {
      console.log('Updating user in users table...');
      user = await prisma.users.update({
        where: { id: user.id },
        data: {
          role: 'ADMIN',
          raw_user_meta_data: meta,
        }
      });
      console.log('User updated:', user.id);
    }

    // Now ensure profile exists
    const profile = await prisma.profiles.findFirst({
      where: { id: userId }
    });

    if (!profile) {
      console.log('Creating profile...');
      await prisma.profiles.create({
        data: {
          id: userId,
          role: 'ADMIN',
          full_name: 'Al Ameen Admin',
        }
      });
      console.log('Profile created');
    } else {
      console.log('Updating profile...');
      await prisma.profiles.update({
        where: { id: userId },
        data: {
          role: 'ADMIN',
          full_name: 'Al Ameen Admin',
        }
      });
      console.log('Profile updated');
    }

    console.log('SUCCESS: alameenadmin@yopmail.com / Mindz@007 ready!');
  } catch (err) {
    console.error('Error seeding user:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedUser();
