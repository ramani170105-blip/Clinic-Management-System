"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
router.post('/register', [
    (0, express_validator_1.body)('password').isLength({ min: 6 }),
    (0, express_validator_1.body)('role').isIn(['ADMIN', 'DOCTOR', 'PATIENT', 'NURSE']),
], async (req, res) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email, password, role, name, phone, specialisation, workingHoursStart, workingHoursEnd, age, medicalHistory, pictureUrl } = req.body;
    try {
        if (email) {
            const existingUser = await index_1.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                res.status(400).json({ error: 'Email already exists' });
                return;
            }
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        let empId = null;
        if (role === 'DOCTOR' || role === 'NURSE') {
            // Generate random empId like DOC12345 or NUR12345
            const prefix = role === 'DOCTOR' ? 'DOC' : 'NUR';
            empId = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;
        }
        const user = await index_1.prisma.user.create({
            data: {
                email: role === 'PATIENT' ? email : null,
                empId,
                passwordHash,
                role,
            },
        });
        if (role === 'PATIENT') {
            await index_1.prisma.patientProfile.create({
                data: {
                    userId: user.id,
                    name,
                    phone,
                    age: age ? parseInt(age) : null,
                    medicalHistory,
                    pictureUrl
                },
            });
        }
        else if (role === 'DOCTOR') {
            await index_1.prisma.doctorProfile.create({
                data: {
                    userId: user.id,
                    name,
                    specialisation: specialisation || 'General',
                    workingHoursStart: workingHoursStart || '09:00',
                    workingHoursEnd: workingHoursEnd || '17:00',
                    slotDurationMins: 30,
                },
            });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'super_secret_jwt', { expiresIn: '24h' });
        res.status(201).json({ token, user: { id: user.id, email: user.email, empId: user.empId, role: user.role } });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    const { name, phone, email, empId, password, role } = req.body;
    try {
        let user;
        if (role === 'ADMIN') {
            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required for admin' });
                return;
            }
            user = await index_1.prisma.user.findUnique({ where: { email } });
            if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }
            const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isMatch) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }
        }
        else if (role === 'DOCTOR' || role === 'NURSE') {
            if (!empId || !password) {
                res.status(400).json({ error: 'Employee ID and password are required for this role' });
                return;
            }
            user = await index_1.prisma.user.findUnique({ where: { empId } });
            if (!user || !user.passwordHash) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }
            const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isMatch) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }
        }
        else {
            // PATIENT role (Passwordless Auto-login / Registration)
            if (!name || !phone) {
                res.status(400).json({ error: 'Name and Phone are required for patients' });
                return;
            }
            let patientProfile = await index_1.prisma.patientProfile.findFirst({ where: { phone } });
            if (!patientProfile) {
                // Auto register patient
                user = await index_1.prisma.user.create({
                    data: {
                        role: 'PATIENT',
                        email: email || null // save email to the user for notifications!
                    }
                });
                patientProfile = await index_1.prisma.patientProfile.create({
                    data: {
                        userId: user.id,
                        name,
                        phone
                    }
                });
            }
            else {
                user = await index_1.prisma.user.findUnique({ where: { id: patientProfile.userId } });
                if (user) {
                    let userUpdated = false;
                    let patientUpdated = false;
                    if (email && user.email !== email) {
                        await index_1.prisma.user.update({ where: { id: user.id }, data: { email } });
                        userUpdated = true;
                    }
                    if (patientProfile.name !== name) {
                        await index_1.prisma.patientProfile.update({ where: { id: patientProfile.id }, data: { name } });
                        patientUpdated = true;
                    }
                    if (userUpdated) {
                        user.email = email;
                    }
                }
            }
        }
        if (!user) {
            res.status(500).json({ error: 'User data could not be retrieved' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'super_secret_jwt', { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, empId: user.empId, role: user.role } });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map