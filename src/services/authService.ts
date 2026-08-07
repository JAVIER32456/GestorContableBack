import bcrypt from 'bcrypt';
import prisma from '../prisma.js';
import { generateToken } from '../middleware/auth.js';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errorHandler.js';

const SALT_ROUNDS = 10;

/**
 * Registra un nuevo usuario
 */
export const registerUser = async (
  firstName: string,
  lastName: string | null,
  email: string,
  password: string
) => {
  try {
    // Verificar si el email ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('El email ya está registrado');
    }

    // Hashear la contraseña
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Crear el usuario
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName: lastName || null,
        email,
        passwordHash,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Generar token
    const token = generateToken(user.id);

    return {
      user,
      token,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Autentica un usuario (login)
 */
export const loginUser = async (email: string, password: string) => {
  try {
    // Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
        passwordHash: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('Email o contraseña incorrectos');
    }

    if (!user.isActive) {
      throw new AuthenticationError('La cuenta está desactivada');
    }

    // Verificar la contraseña
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AuthenticationError('Email o contraseña incorrectos');
    }

    // Generar token
    const token = generateToken(user.id);

    // Retornar usuario sin passwordHash
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Cambia la contraseña del usuario
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  try {
    // Obtener el usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundError('Usuario');
    }

    // Verificar la contraseña actual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new ValidationError('La contraseña actual es incorrecta');
    }

    // Hashear la nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Actualizar la contraseña
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return {
      message: 'Contraseña cambiad correctamente',
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Solicita recuperación de contraseña (genera un token temporal)
 */
export const requestPasswordReset = async (email: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      // Por seguridad, no revelar si el email existe
      return {
        message: 'Si el email existe, recibirás un enlace para resetear tu contraseña',
      };
    }

    // Generar un token temporal (expires en 1 hora)
    const resetToken = generateToken(user.id, '1h');

    // TODO: Enviar email con el token
    // const emailSent = await sendPasswordResetEmail(user.email, resetToken);

    return {
      message: 'Si el email existe, recibirás un enlace para resetear tu contraseña',
      // TODO: Remover en producción
      resetToken,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Resetea la contraseña con un token válido
 */
export const resetPassword = async (token: string, newPassword: string) => {
  try {
    // Verificar y decodificar el token
    const decoded: any = require('jsonwebtoken').verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    );

    const userId = decoded.userId;

    // Hashear la nueva contraseña
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Actualizar la contraseña
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    return {
      message: 'Contraseña reseteada correctamente',
    };
  } catch (error) {
    throw new ValidationError('Token inválido o expirado');
  }
};

/**
 * Obtiene el perfil del usuario actual
 */
export const getCurrentUser = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('Usuario');
    }

    return user;
  } catch (error) {
    throw error;
  }
};
