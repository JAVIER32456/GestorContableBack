import { ValidationError } from './errorHandler.js';

/**
 * Validadores para campos de usuario
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

export const validateEmail = (email: string): boolean => {
  return EMAIL_REGEX.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= PASSWORD_MIN_LENGTH;
};

export const validateName = (name: string): boolean => {
  return Boolean(name) && name.length >= 2 && name.length <= 100;
};

/**
 * Validador para registro de usuario
 */
export const validateUserRegistration = (data: any) => {
  const errors: Record<string, string[]> = {};

  if (!data.email || !validateEmail(data.email)) {
    errors.email = ['Email inválido'];
  }

  if (!data.firstName || !validateName(data.firstName)) {
    errors.firstName = ['El nombre debe tener entre 2 y 100 caracteres'];
  }

  if (!data.password || !validatePassword(data.password)) {
    errors.password = [`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validación de registro fallida', errors);
  }
};

/**
 * Validador para login
 */
export const validateUserLogin = (data: any) => {
  const errors: Record<string, string[]> = {};

  if (!data.email || !validateEmail(data.email)) {
    errors.email = ['Email requerido y válido'];
  }

  if (!data.password) {
    errors.password = ['Contraseña requerida'];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validación de login fallida', errors);
  }
};

/**
 * Validador para crear movimiento
 */
export const validateMovementCreation = (data: any) => {
  const errors: Record<string, string[]> = {};

  if (!data.userId) {
    errors.userId = ['Usuario requerido'];
  }

  if (!data.categoryId) {
    errors.categoryId = ['Categoría requerida'];
  }

  if (!data.movementTypeId) {
    errors.movementTypeId = ['Tipo de movimiento requerido'];
  }

  if (!data.amount || data.amount <= 0) {
    errors.amount = ['El monto debe ser mayor a 0'];
  }

  if (!data.movementDate) {
    errors.movementDate = ['Fecha del movimiento requerida'];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validación de movimiento fallida', errors);
  }
};

/**
 * Validador para actualizar usuario
 */
export const validateUserUpdate = (data: any) => {
  const errors: Record<string, string[]> = {};

  if (data.email && !validateEmail(data.email)) {
    errors.email = ['Email inválido'];
  }

  if (data.firstName && !validateName(data.firstName)) {
    errors.firstName = ['El nombre debe tener entre 2 y 100 caracteres'];
  }

  if (data.password && !validatePassword(data.password)) {
    errors.password = [`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validación de actualización fallida', errors);
  }
};

/**
 * Validador para cambio de contraseña
 */
export const validatePasswordChange = (data: any) => {
  const errors: Record<string, string[]> = {};

  if (!data.currentPassword) {
    errors.currentPassword = ['Contraseña actual requerida'];
  }

  if (!data.newPassword || !validatePassword(data.newPassword)) {
    errors.newPassword = [`La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`];
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = ['Confirmación de contraseña requerida'];
  }

  if (data.newPassword && data.confirmPassword && data.newPassword !== data.confirmPassword) {
    errors.confirmPassword = ['Las contraseñas no coinciden'];
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validación de cambio de contraseña fallida', errors);
  }
};
