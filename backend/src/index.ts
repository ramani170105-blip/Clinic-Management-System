import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import doctorRoutes from './routes/doctor';
import patientRoutes from './routes/patient';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhook';

export const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhook', webhookRoutes); // e.g. for Google Calendar

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

import { startCronJobs } from './workers/cron';

startCronJobs();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
