import express from 'express';
import type { Router } from 'express';
import prisma from '../prisma.js';
import {
  parsePositiveInt,
  calculateSkip,
  createPaginationMeta,
  parseIncludeParam,
} from '../utils/pagination.js';
import { verifyToken } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import { uploadImageBuffer, deleteImageByUrl } from '../utils/cloudinary.js';
import { updateUser } from '../services/authService.js';

const router: Router = express.Router();

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  profileImage: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

// GET - Obtener todos los usuarios
// Query params: ?page=1&limit=10&include=movements,auditLogs
router.get('/', async (req: any, res: any) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const skip = calculateSkip(page, limit);
    const include = parseIncludeParam(req.query.include);

    // Construir select con relaciones opcionales
    let selectQuery: any = { ...userSelect };
    if (include.includes('movements')) {
      selectQuery.movements = {
        select: {
          id: true,
          amount: true,
          movementDate: true,
        },
      };
    }
    if (include.includes('auditlogs')) {
      selectQuery.auditLogs = {
        select: {
          id: true,
          action: true,
          entity: true,
          createdAt: true,
        },
      };
    }
    if (include.includes('reports')) {
      selectQuery.reports = {
        select: {
          id: true,
          fileName: true,
          reportType: true,
          createdAt: true,
        },
      };
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: selectQuery,
      }),
    ]);

    res.json({
      data: users,
      meta: createPaginationMeta(total, page, limit, users.length),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});


// PUT - Actualizar perfil del usuario autenticado
router.put('/profile', verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    const { firstName, lastName, email } = req.body;

    const user = await updateUser(
      userId,
      firstName,
      lastName,
      email
    );

    res.json({
      success: true,
      data: user,
    });

  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al actualizar el perfil',
    });
  }
});



// POST - Crear usuario
router.post('/', async (req: any, res: any) => {
  try {
    const { firstName, lastName, email, passwordHash } = req.body;

    if (!firstName || !email || !passwordHash) {
      return res.status(400).json({ error: 'Campos requeridos: firstName, email, passwordHash' });
    }

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName: lastName || null,
        email,
        passwordHash,
      },
      select: userSelect,
    });
    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El email ya existe' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// GET - Obtener usuario por ID
router.get('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// PUT - Actualizar usuario
router.put('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, passwordHash, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email && { email }),
        ...(passwordHash && { passwordHash }),
        ...(isActive !== undefined && { isActive }),
      },
      select: userSelect,
    });
    res.json(user);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE - Eliminar usuario
router.delete('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({
      where: { id },
    });
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// POST - Subir/actualizar foto de perfil (requiere autenticación)
router.post('/:id/profile-image', verifyToken, uploadImage.single('image'), async (req: any, res: any) => {
  try {
    const { id } = req.params;

    if (req.user.userId !== id) {
      return res.status(403).json({ error: 'No tienes permisos para actualizar este usuario' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Debes enviar una imagen en el campo "image"' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { profileImage: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const imageUrl = await uploadImageBuffer(req.file.buffer);

    // Elimina la imagen anterior de Cloudinary si existía
    if (existingUser.profileImage) {
      await deleteImageByUrl(existingUser.profileImage).catch(() => {});
    }

    const user = await prisma.user.update({
      where: { id },
      data: { profileImage: imageUrl },
      select: userSelect,
    });

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al subir la imagen de perfil' });
  }
});



export default router;
