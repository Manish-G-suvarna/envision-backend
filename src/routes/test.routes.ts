import express from 'express';
import prisma from '../config/prisma';
import { emitEventUpdate } from '../utils/socketUtils';

const router = express.Router();

// This route is for testing/simulation purposes as requested
router.post('/trigger-update', async (req, res) => {
    try {
        const events = await prisma.event.findMany({
            orderBy: { id: 'asc' }
        });
        emitEventUpdate(events);
        res.json({ message: 'Update emitted successfully', count: events.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to trigger update' });
    }
});

export default router;
