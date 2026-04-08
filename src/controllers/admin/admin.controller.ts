import { Request, Response } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import prisma from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../../types/auth';

const adminResponse = {
    id: true,
    email: true,
    name: true,
    is_active: true,
    last_login_at: true,
    created_at: true,
    updated_at: true,
} as const;

const formatAdmin = (admin: {
    id: number;
    email: string;
    name: string;
    is_active: boolean;
    last_login_at: Date | null;
    created_at: Date;
    updated_at: Date;
}) => ({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    isActive: admin.is_active,
    lastLoginAt: admin.last_login_at,
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
});

export const listAdmins = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 20);
        const search = req.query.search as string | undefined;
        const isActive = req.query.isActive as string | undefined;
        const skip = (page - 1) * limit;

        const where: {
            OR?: Array<{ email?: { contains: string; mode: 'insensitive' }; name?: { contains: string; mode: 'insensitive' } }>;
            is_active?: boolean;
        } = {};

        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (isActive !== undefined) {
            where.is_active = isActive === 'true';
        }

        const [admins, total] = await Promise.all([
            prisma.admin.findMany({
                where,
                skip,
                take: limit,
                select: adminResponse,
                orderBy: { created_at: 'desc' },
            }),
            prisma.admin.count({ where }),
        ]);

        res.json({
            data: admins.map(formatAdmin),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error listing admins:', error);
        res.status(500).json({ message: 'Error listing admins' });
    }
};

export const createAdmin = async (req: Request, res: Response) => {
    try {
        const { email, name, password } = req.body;

        // Check if email already exists in our DB
        const existing = await prisma.admin.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true },
        });

        if (existing) {
            res.status(409).json({ message: 'Admin email already exists' });
            return;
        }

        // Create user in Clerk
        const clerkUser = await clerkClient.users.createUser({
            emailAddress: [email.toLowerCase()],
            password,
            firstName: name.split(' ')[0],
            lastName: name.split(' ').slice(1).join(' ') || '',
        });

        // Hash password for local login
        const password_hash = await bcrypt.hash(password, 10);

        // Create admin record in our DB
        const admin = await prisma.admin.create({
            data: {
                clerk_user_id: clerkUser.id,
                email: email.toLowerCase(),
                name,
                password_hash,
            },
            select: adminResponse,
        });

        res.status(201).json({
            message: 'Admin created successfully',
            admin: formatAdmin(admin),
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: 'Error creating admin' });
    }
};

export const updateAdminStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const adminId = Number(req.params.id);
        const { is_active } = req.body;

        if (req.admin?.id === adminId && !is_active) {
            res.status(400).json({ message: 'You cannot deactivate your own account' });
            return;
        }

        const admin = await prisma.admin.update({
            where: { id: adminId },
            data: { is_active },
            select: adminResponse,
        });

        res.json({
            message: `Admin ${is_active ? 'activated' : 'deactivated'} successfully`,
            admin: formatAdmin(admin),
        });
    } catch (error) {
        console.error('Error updating admin status:', error);
        res.status(500).json({ message: 'Error updating admin status' });
    }
};

export const resetAdminPassword = async (req: Request, res: Response) => {
    try {
        const adminId = Number(req.params.id);
        const { password } = req.body;

        // Get admin from DB to find their Clerk user ID
        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
        });

        if (!admin) {
            res.status(404).json({ message: 'Admin not found' });
            return;
        }

        if (!admin.clerk_user_id) {
            res.status(400).json({ message: 'Admin does not have a Clerk account' });
            return;
        }

        // 1. Update password in Clerk
        await clerkClient.users.updateUser(admin.clerk_user_id, {
            password,
        });

        // 2. Update password hash in local DB
        const password_hash = await bcrypt.hash(password, 10);
        await prisma.admin.update({
            where: { id: adminId },
            data: { password_hash },
        });

        res.json({ message: 'Admin password reset successfully' });
    } catch (error) {
        console.error('Error resetting admin password:', error);
        res.status(500).json({ message: 'Error resetting admin password' });
    }
};

export const deleteAdmin = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const adminId = Number(req.params.id);

        if (req.admin?.id === adminId) {
            res.status(400).json({ message: 'You cannot delete your own account' });
            return;
        }

        const remainingAdmins = await prisma.admin.count({
            where: {
                id: { not: adminId },
                is_active: true,
            },
        });

        if (remainingAdmins === 0) {
            res.status(400).json({ message: 'At least one active admin must remain' });
            return;
        }

        // Get admin to find Clerk user ID
        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
        });

        if (!admin) {
            res.status(404).json({ message: 'Admin not found' });
            return;
        }

        // Delete from Clerk if they have a Clerk account
        if (admin.clerk_user_id) {
            await clerkClient.users.deleteUser(admin.clerk_user_id);
        }

        // Delete from our DB
        await prisma.admin.delete({
            where: { id: adminId },
        });

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: 'Error deleting admin' });
    }
};
