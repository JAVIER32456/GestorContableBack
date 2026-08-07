import { Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '../utils/errorHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware para verificar token JWT
 */
export const verifyToken = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
      throw new AuthenticationError('Token no proporcionado');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
        },
      });
    }

    res.status(401).json({
      success: false,
      error: {
        message: 'Token inválido',
        code: 'INVALID_TOKEN',
      },
    });
  }
};

/**
 * Genera un token JWT
 */
export const generateToken = (userId: string, expiresIn: SignOptions['expiresIn'] = '12h'): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
};

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
export const optionalAuth = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Ignorar errores, continuar sin autenticación
    next();
  }
};

/**
 * Middleware para verificar que el usuario es propietario del recurso
 */
export const verifyResourceOwner = (paramName: string = 'userId') => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'No autenticado',
          code: 'AUTHENTICATION_ERROR',
        },
      });
    }

    const resourceUserId = req.params[paramName] || req.body[paramName];

    if (req.user.userId !== resourceUserId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para acceder a este recurso',
          code: 'AUTHORIZATION_ERROR',
        },
      });
    }

    next();
  };
};
