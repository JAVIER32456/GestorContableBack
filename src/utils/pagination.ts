/**
 * Parsea un número positivo de los query params
 */
export const parsePositiveInt = (value: any, fallback: number): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Calcula skip para Prisma basado en página y límite
 */
export const calculateSkip = (page: number, limit: number): number => {
  return (page - 1) * limit;
};

/**
 * Estructura de metadatos de paginación
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Crea metadatos de paginación
 */
export const createPaginationMeta = (
  total: number,
  page: number,
  limit: number,
  itemsReturned: number
): PaginationMeta => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: (page - 1) * limit + itemsReturned < total,
  };
};

/**
 * Parsea el parámetro "include" de query params para lazy loading
 * Ejemplo: ?include=user,category -> ['user', 'category']
 */
export const parseIncludeParam = (includeStr: any): string[] => {
  if (!includeStr || typeof includeStr !== 'string') {
    return [];
  }
  return includeStr
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
};

/**
 * Construye objeto de select para relaciones lazy loading
 * Usado para Movement y sus relaciones (user, category, movementType)
 */
export const buildMovementSelect = (include: string[]) => {
  const baseSelect = {
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
  };

//   if (!include.length) return baseSelect;

  const relations: any = {
    category: {
      select: {
        id: true,
        name: true,
      },
    },

    movementType: {
      select: {
        id: true,
        name: true,
      },
    },

  };


  if (include.includes('user')) {
    relations.user = {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    };
  }

//   if (include.includes('category')) {
//     relations.category = {
//       select: {
//         id: true,
//         name: true,
//         description: true,
//         isActive: true,
//       },
//     };
//   }

//   if (include.includes('movementtype')) {
//     relations.movementType = {
//       select: {
//         id: true,
//         code: true,
//         name: true,
//       },
//     };
//   }

  return { ...baseSelect, ...relations };
};

/**
 * Construye objeto de select para relaciones lazy loading en auditoría
 */
export const buildAuditLogSelect = (include: string[]) => {
  const baseSelect = {
    id: true,
    userId: true,
    action: true,
    entity: true,
    entityId: true,
    oldData: true,
    newData: true,
    createdAt: true,
  };

  if (!include.length) return baseSelect;

  const relations: any = {};
  if (include.includes('user')) {
    relations.user = {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
      },
    };
  }

  return { ...baseSelect, ...relations };
};

/**
 * Construye objeto de select para relaciones lazy loading en categorías
 */
export const buildCategorySelect = (include: string[]) => {
  const baseSelect = {
    id: true,
    name: true,
    description: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  };

  if (!include.length) return baseSelect;

  const relations: any = {};
  if (include.includes('movements')) {
    relations.movements = {
      select: {
        id: true,
        amount: true,
        movementDate: true,
      },
    };
  }

  return { ...baseSelect, ...relations };
};
