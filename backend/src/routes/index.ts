import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import authRouter from './auth';
import staffMedicinesRouter from './staff/medicines';
import staffFootfallRouter from './staff/footfall';
import staffBedsRouter from './staff/beds';
import staffAttendanceEmergencyRouter from './staff/attendanceEmergency';
import adminDashboardRouter from './admin/dashboard';
import adminHistoryRouter from './admin/history';
import adminRedistributionRouter from './admin/redistribution';
import federatedRouter from './federated';

const router = Router();

router.use('/auth', authRouter);

// Staff + Admin can write to staff scoped endpoints (admin must pass explicit phcId)
router.use('/staff/medicines', staffMedicinesRouter);
router.use('/staff/footfall',   staffFootfallRouter);
router.use('/staff/beds',       staffBedsRouter);
router.use('/staff',            staffAttendanceEmergencyRouter);

// Admin only routes (auth + role guard applied per sub-router)
router.use('/admin/dashboard', authenticate, requireRole(Role.admin), adminDashboardRouter);
router.use('/admin/history',   authenticate, requireRole(Role.admin), adminHistoryRouter);
router.use('/',                authenticate, requireRole(Role.admin), adminRedistributionRouter);

// Federated learning routes (admin only)
router.use('/federated', authenticate, requireRole(Role.admin), federatedRouter);

export default router;
