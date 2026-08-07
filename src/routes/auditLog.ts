import express from 'express';
import type { Router } from 'express';
import prisma from '../prisma.js';
import {
  parsePositiveInt,
  calculateSkip,
  createPaginationMeta,
  parseIncludeParam,
  buildAuditLogSelect,
} from '../utils/pagination.js';

const router: Router = express.Router();

// GET - Obtener de auditLog todos los datos
// Query params: ?page=1&limit=20&include=user
router.get('/', async (req: any, res: any) => {
    try {
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 10);
        const skip = calculateSkip(page, limit);
        const include = parseIncludeParam(req.query.include);

        const [total, audit] = await prisma.$transaction([
            prisma.auditLog.count(),
            prisma.auditLog.findMany({
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc',
                },
                select: buildAuditLogSelect(include),
            }),
        ]);

        res.json({
            data: audit,
            meta: createPaginationMeta(total, page, limit, audit.length),
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener datos de auditoría' });
    }
});

// GET - Obtener auditLog por ID
router.get('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const audit = await prisma.auditLog.findUnique({
            where: { id },
            select: {
                id: true,
                userId      : true,
                action      : true,
                entity      : true,
                entityId    : true,
                oldData     : true,
                newData     : true,
                createdAt   : true,
            },
    });
    if (!audit) {
            return res.status(404).json({ error: 'datos no encontrados' });
        }
        res.json(audit);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los datos' });
    }
});

// POST - crear una auditoria
router.post('/', async (req: any, res: any ) =>{ 
    try {
        const { userId, action, entity, entityId, oldData, newData } = req.body;
        if (!userId || !action || !entity || !entityId) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        const audit = await prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                oldData,
                newData
            },
            select: {
                id          : true,
                userId      : true,
                action      : true,
                entity      : true,
                entityId    : true,
                oldData     : true,
                newData     : true,
                createdAt   : true,
            },
        });
        res.status(201).json(audit);
    } catch (error: any ) {
        if (error.code === 'P2002'){  // ← Agrega esto
            return res.status(400).json({ error: 'Ya existe un auditoria con ese nombre' });
        }
        res.status(500).json({ error: 'Error al crear la auditoria' });
    }

});

//PUT - Actualizar una auditoria
router.put('/:id', async (req: any, res: any) => {
    try {
        const { id }   = req.params;
        const { userId, action, entity, entityId, oldData, newData } = req.body;
        
        if ( !userId || !entity || !newData ) {
            return res.status(400).json({ error: 'Campos requeridos: user, entidad, newdata' });
        }

        const audit = await prisma.auditLog.update({
            where: {id},
            data: {
                ...(userId   && {  userId   }),
                ...(action   && {  action   }),
                ...(entity   && {  entity   }),
                ...(entityId && {  entityId }),
                ...(oldData  && {  oldData: new Date(oldData) }),
                ...(newData  && {  newData: new Date(newData) }),
            },
            select: {
                id          : true,
                userId      : true,
                action      : true,
                entity      : true,
                entityId    : true,
                oldData     : true,
                newData     : true,
                createdAt   : true,
            },
        });
        res.json(audit);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Auditoria no encontrada' });
        }
        res.status(500).json({ error: 'Error al actualizar reporte '});
    }
});

// DELETE - Eliminar auditoria por ID
router.delete('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        await prisma.auditLog.delete({
            where: { id },
        });
        res.json({ message: 'Auditoria eliminada correctamente' });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Auditoria no encontrada'});
        }
        res.status(500).json({ error: 'Error al eliminar reporte' });
    }
});

export default router;