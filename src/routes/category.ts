import express from 'express';
import type { Router } from 'express';
import prisma from '../prisma.js';
import type { Prisma } from '../generated/client/index.js';
import {
  parsePositiveInt,
  calculateSkip,
  createPaginationMeta,
  parseIncludeParam,
  buildCategorySelect,
} from '../utils/pagination.js';
import { verifyToken } from '../middleware/auth.js';

const router: Router = express.Router();

// GET - Obtener categorías del usuario + las generales (sin userId)
// Query params: ?page=1&limit=10&include=movements
router.get('/', verifyToken, async (req: any, res: any) => {
    try {
        const page = parsePositiveInt(req.query.page, 1);
        const limit = parsePositiveInt(req.query.limit, 10);
        const skip = calculateSkip(page, limit);
        const include = parseIncludeParam(req.query.include);
        const userId = req.user.userId;

        // Trae las categorías propias del usuario + las generales (userId null)
        const where: Prisma.CategoryWhereInput = {
            OR: [{ userId }, { userId: null }],
        };

        const [total, categories] = await prisma.$transaction([
            prisma.category.count({ where }),
            prisma.category.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                where,
                select: buildCategorySelect(include),
            }),
        ]);

        res.json({
            data: categories,
            meta: createPaginationMeta(total, page, limit, categories.length),
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// GET - Obtener categoría por ID
router.get('/:id', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const category = await prisma.category.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!category) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categoría' });
    }
});

// POST - Crear categoría (siempre asignada al usuario autenticado)
router.post('/', verifyToken, async (req: any, res: any) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.userId;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
        userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(201).json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {  // ← Agrega esto
        return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

// PUT - Actualizar categoría
router.put('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {  // ← Agrega esto
        return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

// DELETE - Eliminar categoría
router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({
      where: { id },
    });
    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

export default router;