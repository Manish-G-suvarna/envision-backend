import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/prisma';
import { env } from '../../config/env';
import { AuthenticatedRequest } from '../../types/auth';

export const loginAdmin = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            res.status(400).json({ message: 'Email and password are required' });
            return;
        }

        const admin = await prisma.admin.findUnique({
            where: { email },
        });

        if (!admin || !admin.password_hash) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        if (!admin.is_active) {
            res.status(403).json({ message: 'Account is inactive' });
            return;
        }

        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        // Update last login
        await prisma.admin.update({
            where: { id: admin.id },
            data: { last_login_at: new Date() },
        });

        // Generate Token
        const token = jwt.sign(
            { id: admin.id, email: admin.email },
            env.ADMIN_JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                isActive: admin.is_active,
            }
        });
    } catch (error) {
        console.error('Error logging in admin:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getCurrentAdmin = async (req: AuthenticatedRequest, res: Response) => {
    if (!req.admin) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    try {
        const admin = await prisma.admin.findUnique({
            where: { id: req.admin.id },
            select: {
                id: true,
                email: true,
                name: true,
                is_active: true,
                last_login_at: true,
                created_at: true,
                updated_at: true,
            },
        });

        if (!admin) {
            res.status(404).json({ message: 'Admin not found' });
            return;
        }

        res.json({
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                isActive: admin.is_active,
                lastLoginAt: admin.last_login_at,
                createdAt: admin.created_at,
                updatedAt: admin.updated_at,
            },
        });
    } catch (error) {
        console.error('Error fetching current admin:', error);
        res.status(500).json({ message: 'Error fetching current admin' });
    }
};
