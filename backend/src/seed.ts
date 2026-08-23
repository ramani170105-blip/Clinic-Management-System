import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const empId = 'DOC00000';
  const password = 'password123';
  
  const existingUser = await prisma.user.findUnique({ where: { empId } });
  
  if (!existingUser) {
    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        empId,
        passwordHash,
        role: 'DOCTOR',
      },
    });

    await prisma.doctorProfile.create({
      data: {
        userId: user.id,
        name: 'Dr. Default',
        specialisation: 'General Medicine',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        slotDurationMins: 30,
      }
    });

    console.log(`Default doctor created!`);
  } else {
    console.log(`Default doctor already exists.`);
  }
  
  console.log(`Emp ID: ${empId}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
