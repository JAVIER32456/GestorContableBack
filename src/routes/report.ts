import express from 'express';
import type { Router } from 'express';
import prisma from '../prisma.js';

const router: Router = express.Router();

const reportSelect = {
    id         : true,
    userId     : true,
    fileName   : true,
    filePath   : true,
    pdfUrl     : true,
    reportType : true,
    startDate  : true,
    endDate    : true,
    createdAt  : true,
    user       : {
        select: {
            id        : true,
            firstName : true,
            lastName  : true,
            email     : true,
            isActive  : true,
            createdAt : true,
            updatedAt : true,
        },
    },
};

const parsePositiveInt = (value: any, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// GET - Obtener todos los reportes
router.get('/', async (req: any, res: any) => {
    try {
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 10);
        const skip = (page - 1) * limit;

        const [total, reports] = await prisma.$transaction([
            prisma.report.count(),
            prisma.report.findMany({
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc',
                },
                select: reportSelect,
            }),
        ]);

        res.json({
            data: reports,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + reports.length < total,
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener reportes' });
    }
});

// GET - Obtener reporte por ID
router.get('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;  
        const report = await prisma.report.findUnique({
            where: { id },
            select: reportSelect,
        });
        if (!report) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener reporte' });
    }   
});

// POST - Crear reporte
router.post('/', async (req: any, res: any) => {
    try {
        const { userId, fileName, filePath, pdfUrl, reportType, startDate, endDate } = req.body;   
        if (!userId || !fileName || !filePath || !pdfUrl || !reportType || !startDate || !endDate) {
            return res.status(400).json({ error: 'Campos requeridos: userId, fileName, filePath, pdfUrl, reportType, startDate, endDate' });
        }
        const report = await prisma.report.create({
            data: {
                userId,
                fileName,
                filePath,
                pdfUrl,
                reportType,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            },
            select: reportSelect,
        });
        res.status(201).json(report);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear reporte' });
    }
});


// PUT - Actualizar reporte por ID
router.put('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { userId, fileName, filePath, pdfUrl, reportType, startDate, endDate } = req.body;
        const report = await prisma.report.update({
            where: { id },
            data: {
                ...(userId && { userId }),
                ...(fileName && { fileName }),
                ...(filePath && { filePath }),
                ...(pdfUrl && { pdfUrl }),

                ...(reportType && { reportType }),
                ...(startDate && { startDate: new Date(startDate) }),
                ...(endDate && { endDate: new Date(endDate) }),
            },
            select: reportSelect,
        });
        res.json(report);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.status(500).json({ error: 'Error al actualizar reporte' });
    }
});

// DELETE - Eliminar reporte por ID 
router.delete('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        await prisma.report.delete({
            where: { id },
        });
        res.json({ message: 'Reporte eliminado correctamente' });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }
        res.status(500).json({ error: 'Error al eliminar reporte' });
    }
});

export default router;