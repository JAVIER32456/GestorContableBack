import prisma from '../prisma.js';

/**
 * Obtiene el resumen general del dashboard
 * - Total de ingresos
 * - Total de egresos
 * - Saldo total
 * - Últimos 5 movimientos
 * - Desglose por categoría
 */
export const getDashboardSummary = async (userId: string, period: 'this_month' | 'this_year' | 'all' = 'this_month') => {
  try {
    // Calcular fechas según el período
    const now = new Date();
    let startDate: Date;

    if (period === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'this_year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(0); // Desde el inicio
    }

    // Obtener todos los movimientos del usuario en el período
    const movements = await prisma.movement.findMany({
      where: {
        userId,
        movementDate: {
          gte: startDate,
        },
        deletedAt: null,
      },
      include: {
        category: true,
        movementType: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        movementDate: 'desc',
      },
    });

    // Calcular totales por tipo
    const totalIncome = movements
      .filter((m) => m.movementType.code === 'INCOME')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const totalExpense = movements
      .filter((m) => m.movementType.code === 'EXPENSE')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const balance = totalIncome - totalExpense;

    // Últimos 5 movimientos
    const recentMovements = movements.slice(0, 5).map((m) => ({
      id: m.id,
      description: m.description,
      amount: Number(m.amount),
      category: m.category.name,
      type: m.movementType.code,
      date: m.movementDate,
    }));

    // Desglose por categoría
    const categoryBreakdown = movements.reduce(
      (acc: any[], m) => {
        const existing = acc.find((item) => item.categoryId === m.categoryId);
        if (existing) {
          existing.amount += Number(m.amount);
          existing.count += 1;
        } else {
          acc.push({
            categoryId: m.categoryId,
            categoryName: m.category.name,
            amount: Number(m.amount),
            count: 1,
          });
        }
        return acc;
      },
      []
    );

    // Top 3 categorías por gasto
    const topCategories = categoryBreakdown
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return {
      totalIncome,
      totalExpense,
      balance,
      totalMovements: movements.length,
      period,
      recentMovements,
      categoryBreakdown,
      topCategories,
    };
  } catch (error) {
    console.error('Error en getDashboardSummary:', error);
    throw error;
  }
};

/**
 * Obtiene el movimiento con el mayor valor
 */
export const getHighestMovement = async (userId: string) => {
  try {
    const movement = await prisma.movement.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        category: true,
        movementType: true,
      },
      orderBy: {
        amount: 'desc',
      },
    });

    if (!movement) {
      return null;
    }

    return {
      id: movement.id,
      description: movement.description,
      amount: Number(movement.amount),
      category: movement.category.name,
      type: movement.movementType.code,
      date: movement.movementDate,
    };
  } catch (error) {
    console.error('Error en getHighestMovement:', error);
    throw error;
  }
};

/**
 * Obtiene movimientos filtrados por tipo y período
 */
export const getMovementsByType = async (
  userId: string,
  type: 'INCOME' | 'EXPENSE',
  limit: number = 10
) => {
  try {
    const movements = await prisma.movement.findMany({
      where: {
        userId,
        movementType: {
          code: type,
        },
        deletedAt: null,
      },
      include: {
        category: true,
        movementType: true,
      },
      orderBy: {
        movementDate: 'desc',
      },
      take: limit,
    });

    return movements.map((m) => ({
      id: m.id,
      description: m.description,
      amount: Number(m.amount),
      category: m.category.name,
      date: m.movementDate,
      createdAt: m.createdAt,
    }));
  } catch (error) {
    console.error('Error en getMovementsByType:', error);
    throw error;
  }
};

/**
 * Obtiene resumen por rango de fechas personalizado
 */
export const getMovementsSummaryByDateRange = async (
  userId: string,
  startDate: Date,
  endDate: Date
) => {
  try {
    const movements = await prisma.movement.findMany({
      where: {
        userId,
        movementDate: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      include: {
        movementType: true,
      },
    });

    const totalIncome = movements
      .filter((m) => m.movementType.code === 'INCOME')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const totalExpense = movements
      .filter((m) => m.movementType.code === 'EXPENSE')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      totalMovements: movements.length,
      startDate,
      endDate,
    };
  } catch (error) {
    console.error('Error en getMovementsSummaryByDateRange:', error);
    throw error;
  }
};
