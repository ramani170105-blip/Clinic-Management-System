import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { body, validationResult } from 'express-validator';

const router = Router();

router.post(
  '/register',
  [
    body('password').isLength({ min: 6 }),
    body('role').isIn(['ADMIN', 'DOCTOR', 'PATIENT', 'NURSE']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, role, name, phone, specialisation, workingHoursStart, workingHoursEnd, age, medicalHistory, pictureUrl } = req.body;

    try {
      if (email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          res.status(400).json({ error: 'Email already exists' });
          return;
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);

      let empId = null;
      if (role === 'DOCTOR' || role === 'NURSE') {
        // Generate random empId like DOC12345 or NUR12345
        const prefix = role === 'DOCTOR' ? 'DOC' : 'NUR';
        empId = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;
      }

      const user = await prisma.user.create({
        data: {
          email: role === 'PATIENT' ? email : null,
          empId,
          passwordHash,
          role,
        },
      });

      if (role === 'PATIENT') {
        await prisma.patientProfile.create({
          data: {
            userId: user.id,
            name,
            phone,
            age: age ? parseInt(age) : null,
            medicalHistory,
            pictureUrl
          },
        });
      } else if (role === 'DOCTOR') {
        await prisma.doctorProfile.create({
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

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || 'super_secret_jwt',
        { expiresIn: '24h' }
      );

      res.status(201).json({ token, user: { id: user.id, email: user.email, empId: user.empId, role: user.role } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/login',
  async (req: Request, res: Response): Promise<void> => {
    const { name, phone, email, empId, password, role } = req.body;

    try {
      let user;

      if (role === 'ADMIN') {
        if (!email || !password) {
          res.status(400).json({ error: 'Email and password are required for admin' });
          return;
        }
        user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
      } else if (role === 'DOCTOR' || role === 'NURSE') {
        if (!empId || !password) {
          res.status(400).json({ error: 'Employee ID and password are required for this role' });
          return;
        }
        user = await prisma.user.findUnique({ where: { empId } });
        
        if (!user || !user.passwordHash) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
      } else {
        // PATIENT role (Passwordless Auto-login / Registration)
        if (!name || !phone) {
          res.status(400).json({ error: 'Name and Phone are required for patients' });
          return;
        }
        
        let patientProfile = await prisma.patientProfile.findFirst({ where: { phone } });
        
        if (!patientProfile) {
          // Auto register patient
          user = await prisma.user.create({
            data: {
              role: 'PATIENT',
              email: email || null // save email to the user for notifications!
            }
          });
          patientProfile = await prisma.patientProfile.create({
            data: {
              userId: user.id,
              name,
              phone
            }
          });
        } else {
          user = await prisma.user.findUnique({ where: { id: patientProfile.userId } });
          if (user) {
            let userUpdated = false;
            let patientUpdated = false;

            if (email && user.email !== email) {
              await prisma.user.update({ where: { id: user.id }, data: { email } });
              userUpdated = true;
            }
            if (patientProfile.name !== name) {
              await prisma.patientProfile.update({ where: { id: patientProfile.id }, data: { name } });
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

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || 'super_secret_jwt',
        { expiresIn: '24h' }
      );

      res.json({ token, user: { id: user.id, email: user.email, empId: user.empId, role: user.role } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
