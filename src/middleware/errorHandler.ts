import { Response, NextFunction } from 'express';
import { AppError, AuthenticationError, InternalServerError } from '../utils/errorHandler.js';

/**
 * Middleware para manejar errores de forma centralizada
 */
export const errorHandler = (
  err: Error | AppError,
  req: any,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Si es un AppError personalizado
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        ...(err.name === 'ValidationError' && { errors: (err as any).errors }),
      },
    });
  }

  // Errores de Prisma
  if ((err as any).code === 'P2002') {
    // Violación de unicidad
    const target = (err as any).meta?.target?.[0];
    return res.status(409).json({
      success: false,
      error: {
        message: `El ${target} ya existe`,
        code: 'CONFLICT_ERROR',
      },
    });
  }

  if ((err as any).code === 'P2025') {
    // Registro no encontrado
    return res.status(404).json({
      success: false,
      error: {
        message: 'Registro no encontrado',
        code: 'NOT_FOUND_ERROR',
      },
    });
  }

  if ((err as any).code === 'P2003') {
    // Violación de clave foránea
    return res.status(400).json({
      success: false,
      error: {
        message: 'El registro referenciado no existe',
        code: 'INVALID_REFERENCE',
      },
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    error: {
      message: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
};

/**
 * Middleware para manejar 404
 */
export const notFoundHandler = (req: any, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Ruta no encontrada',
      code: 'NOT_FOUND',
    },
  });
};

/**
 * Wrapper para convertir errores síncronos a asíncronos
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
