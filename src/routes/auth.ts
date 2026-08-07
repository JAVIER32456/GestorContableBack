import express from 'express';
import type { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyToken } from '../middleware/auth.js';
import {
  validateUserRegistration,
  validateUserLogin,
  validatePasswordChange,
} from '../utils/validators.js';
import {
  registerUser,
  loginUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
  getCurrentUser,
} from '../services/authService.js';

const router: Router = express.Router();

/**
 * POST /api/auth/register
 * Registra un nuevo usuario
 */
router.post(
  '/register',
  asyncHandler(async (req: any, res: any) => {
    validateUserRegistration(req.body);

    const { firstName, lastName, email, password } = req.body;

    const result = await registerUser(firstName, lastName || null, email, password);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Usuario registrado correctamente',
    });
  })
);

/**
 * POST /api/auth/login
 * Autentica un usuario y retorna un token
 */
router.post(
  '/login',
  asyncHandler(async (req: any, res: any) => {
    validateUserLogin(req.body);

    const { email, password } = req.body;

    const result = await loginUser(email, password);

    res.json({
      success: true,
      data: result,
      message: 'Sesión iniciada correctamente',
    });
  })
);

/**
 * GET /api/auth/me
 * Obtiene el perfil del usuario autenticado
 */
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const user = await getCurrentUser(req.user.userId);

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * POST /api/auth/change-password
 * Cambia la contraseña del usuario autenticado
 */
router.post(
  '/change-password',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    validatePasswordChange(req.body);

    const { currentPassword, newPassword } = req.body;

    const result = await changePassword(req.user.userId, currentPassword, newPassword);

    res.json({
      success: true,
      data: result,
      message: 'Contraseña cambiada correctamente',
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Solicita recuperación de contraseña
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req: any, res: any) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Email es requerido',
        },
      });
    }

    const result = await requestPasswordReset(email);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/auth/reset-password
 * Resetea la contraseña con un token válido
 */
router.post(
  '/reset-password',
  asyncHandler(async (req: any, res: any) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Token y nueva contraseña son requeridos',
        },
      });
    }

    const result = await resetPassword(token, newPassword);

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
