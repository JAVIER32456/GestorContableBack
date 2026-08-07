import express from 'express';
import type { Router } from 'express';
import prisma from '../prisma.js';
import {
  parsePositiveInt,
  calculateSkip,
  createPaginationMeta,
  parseIncludeParam,
  buildMovementSelect,
} from '../utils/pagination.js';
import { verifyToken } from '../middleware/auth.js';

const router: Router = express.Router();

// GET - Obtener movimientos del usuario autenticado
// Query params: ?page=1&limit=20&include=user,category,movementType
router.get('/', verifyToken, async (req: any, res: any) => {
    try {
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 10);
        const skip = calculateSkip(page, limit);
        const include = parseIncludeParam(req.query.include);
        const userId = req.user.userId;

        const where = { userId, deletedAt: null };

        const [total, movements] = await prisma.$transaction([
            prisma.movement.count({ where }),
            prisma.movement.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    movementDate: 'desc',
                },
                select: buildMovementSelect(include),
            }),
        ]);

        res.json({
            data: movements,
            meta: createPaginationMeta(total, page, limit, movements.length),
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener movimientos' });
    }
});

// GET - Obtener datos para el formulario (categorías + tipos de movimiento)
router.get('/form-data', verifyToken, async (req: any, res: any) => {
    try {
        const userId = req.user.userId;

        const [categories, movementTypes] = await prisma.$transaction([
            prisma.category.findMany({
                where: {
                    OR: [{ userId }, { userId: null }],
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    isActive: true,
                },
                orderBy: { name: 'asc' },
            }),
            prisma.movementType.findMany({
                select: {
                    id: true,
                    code: true,
                    name: true,
                },
                orderBy: { name: 'asc' },
            }),
        ]);

        res.json({
            success: true,
            data: {
                categories,
                movementTypes,
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener datos del formulario' });
    }
});

// GET - Obtener movimiento por ID
router.get('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const movement = await prisma.movement.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                categoryId: true,
                movementTypeId: true,
                amount: true,
                sourceOrDestination: true,
                description: true,
                movementDate: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,    
            },
        });
        if (!movement) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        res.json(movement);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener movimiento' });
    }
});

// POST - Crear movimiento (userId se toma del token)
router.post('/', verifyToken, async (req: any, res: any) => {
    try {
        const { categoryId, movementTypeId, amount, movementDate, sourceOrDestination, description } = req.body;
        const userId = req.user.userId;

        if (!categoryId || !movementTypeId || !amount || !movementDate) {
            return res.status(400).json({ error: 'Campos requeridos: categoryId, movementTypeId, amount, movementDate' });
        }
        const movement = await prisma.movement.create({
        data: {
            userId,
            categoryId,
            movementTypeId,
            amount, 
            movementDate: new Date(movementDate),
            sourceOrDestination: sourceOrDestination || null,
            description: description || null,
        },
            select: {
            id: true,
            userId: true,
            categoryId: true,
            movementTypeId: true,
            amount: true,
            sourceOrDestination: true,
            description: true,
            movementDate: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            },
        });
        res.status(201).json(movement);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Error: violación de restricción única' });
        }   
        res.status(500).json({ error: 'Error al crear movimiento' });
    }
});

// PUT - Actualizar movimiento
router.put('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { userId, categoryId, movementTypeId, amount, movementDate, sourceOrDestination, description, deletedAt, isActive } = req.body;

    const movement = await prisma.movement.update({
      where: { id },
      data: {
        ...(userId && { userId }),
        ...(categoryId && { categoryId }),
        ...(movementTypeId && { movementTypeId }),
        ...(amount && { amount }),
        ...(movementDate && { movementDate }),
        ...(sourceOrDestination !== undefined && { sourceOrDestination }),
        ...(description !== undefined && { description }),
        ...(deletedAt !== undefined && { deletedAt }),
      },
      select: {
        id: true,
        userId: true,
        categoryId: true,
        movementTypeId: true,
        amount: true,
        sourceOrDestination: true,
        description: true,
        movementDate: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
    res.json(movement);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    res.status(500).json({ error: 'Error al actualizar movimiento' });
  }
});

// DELETE - Eliminar movimiento
router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await prisma.movement.delete({
      where: { id },
    });
    res.json({ message: 'Movimiento eliminado correctamente' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    res.status(500).json({ error: 'Error al eliminar movimiento' });
  }
});

export default router;
    