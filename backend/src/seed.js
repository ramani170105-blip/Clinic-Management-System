"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const empId = 'DOC00000';
    const password = 'password123';
    const existingUser = await prisma.user.findUnique({ where: { empId } });
    if (!existingUser) {
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
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
    }
    else {
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
//# sourceMappingURL=seed.js.map