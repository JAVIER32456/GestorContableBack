import express from 'express';
import type { Router } from 'express';
import prisma from '../prisma.js';
import {
  parsePositiveInt,
  calculateSkip,
  createPaginationMeta,
} from '../utils/pagination.js';

const router: Router = express.Router();

const movementTypeSelect = {
  id: true,
  code: true,
  name: true,
  createdAt: true,
};

// GET - Obtener todos los Movements Types
// Query params: ?page=1&limit=10
router.get('/', async (req: any, res: any) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const skip = calculateSkip(page, limit);

    const [total, movementTypes] = await prisma.$transaction([
      prisma.movementType.count(),
      prisma.movementType.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: movementTypeSelect,
      }),
    ]);

    res.json({
      data: movementTypes,
      meta: createPaginationMeta(total, page, limit, movementTypes.length),
    });
  }
    catch (error) {
    res.status(500).json({ error: 'Error al obtener Movement Types' });
  }
});

// GET - Obtener Movement Type por ID
router.get('/:id', async (req: any, res: any) => {
  try {    const { id } = req.params;
    const movementType = await prisma.movementType.findUnique({
      where: { id },
        select: {
            id: true,
            code: true,
            name: true,
            createdAt: true,
        },
    });
    if (!movementType) {
      return res.status(404).json({ error: 'Movement Type no encontrado' });
    }
    res.json(movementType);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener Movement Type' });
  }
});

// POST - Crear Movement Type
router.post('/', async (req: any, res: any) => {
  try {
    const { code, name } = req.body;    
    if (!code || !name) {
      return res.status(400).json({ error: 'Campos requeridos: code, name' });
    }   
    const movementType = await prisma.movementType.create({
      data: {
        code,
        name,
      },
      select: {
        id: true,
        code: true,
        name: true,
        createdAt: true,
        },
    });
    res.status(201).json(movementType);
  } catch (error: any) {
        if (error.code === 'P2002') {  // ← Agrega esto
            return res.status(400).json({ error: 'Ya existe un Movement Type con ese código' });
        } else {
            res.status(500).json({ error: 'Error al crear Movement Type' });
        }
    }
});

// PUT actualizar Movement Type
router.put('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { code, name } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: 'Campos requeridos: code, name' });
        }

        const movementType = await prisma.movementType.update({
            where: { id },
            data: {
                code,
                name,
            },
            select: {
                id: true,
                code: true,
                name: true,
                createdAt: true,
            },
        });
        res.json(movementType);
    } catch (error: any) {
        if (error.code === 'P2002') {  // ← Agrega esto
            return res.status(400).json({ error: 'Ya existe un Movement Type con ese código' });
        } else if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Movement Type no encontrado' });
        } else {
            res.status(500).json({ error: 'Error al actualizar Movement Type' });
        }
    }
}); 

// DELETE - Eliminar Movement Type
router.delete('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        await prisma.movementType.delete({
            where: { id },
        });
        res.json({ message: 'Movement Type eliminado correctamente' });
    }
    catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Movement Type no encontrado' });
        } else {            res.status(500).json({ error: 'Error al eliminar Movement Type' });
        }
    }
});

export default router;
