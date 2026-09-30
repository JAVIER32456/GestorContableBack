import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import prisma from '../prisma.js';
import { generateToken } from '../middleware/auth.js';
import { mailer } from '../config/mailer.js';
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

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);

    if (isSamePassword) {
      throw new ValidationError('La nueva contraseña debe ser distinta a la actual');
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
      message: 'Contraseña cambiada correctamente',
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
      console.info('[Password reset] No se envió correo: no hay una cuenta registrada para esa dirección');
      return {
        message: 'Si el email existe, recibirás un enlace para resetear tu contraseña',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const now = new Date();

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    try {
      const mailResult = await mailer.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: user.email,
        subject: 'Restablece tu contraseña de XPENSES',
        text: `Recibimos una solicitud para cambiar tu contraseña. Abre este enlace antes de 30 minutos: ${resetUrl}\n\nSi no solicitaste este cambio, ignora este correo.`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6">
            <h2>Restablece tu contraseña</h2>
            <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta XPENSES.</p>
            <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #22c55e; color: #052e16; text-decoration: none; border-radius: 6px; font-weight: bold">Crear nueva contraseña</a></p>
            <p>El enlace vence en 30 minutos. Si no solicitaste este cambio, ignora este correo.</p>
          </div>
        `,
      });

      console.info('[Password reset] Resultado SMTP:', {
        messageId: mailResult.messageId,
        acceptedCount: mailResult.accepted.length,
        rejectedCount: mailResult.rejected.length,
        response: mailResult.response,
      });
    } catch (emailError) {
      await prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      });
      console.error('No se pudo enviar el correo de recuperación:', emailError);
    }

    return {
      message: 'Si el email existe, recibirás un enlace para resetear tu contraseña',
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Resetea la contraseña con un token válido
 */
export const resetPassword = async (token: string, newPassword: string) => {
  if (newPassword.length < 8) {
    throw new ValidationError('La contraseña debe tener al menos 8 caracteres');
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    const resetRecord = await transaction.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt <= now) {
      throw new ValidationError('Token inválido o expirado');
    }

    const consumed = await transaction.passwordResetToken.updateMany({
      where: {
        id: resetRecord.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumed.count !== 1) {
      throw new ValidationError('Token inválido o expirado');
    }

    await transaction.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    });

    await transaction.passwordResetToken.updateMany({
      where: { userId: resetRecord.userId, usedAt: null },
      data: { usedAt: now },
    });
  });

  return {
    message: 'Contraseña reseteada correctamente',
  };
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

// Función para actualizar usuario (sin router)
export const updateUser = async (
  userId: string,
  firstName: string,
  lastName: string | null,
  email: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  // Verificar que el nuevo email no pertenezca a otro usuario
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new ConflictError('El email ya está registrado');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName: lastName || null,
      email,
    },
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

  return updatedUser;
};



