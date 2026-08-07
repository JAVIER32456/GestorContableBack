import prisma from '../prisma.js';

/**
 * Calcula estadísticas de movimientos
 * - Promedio de gasto
 * - Promedio de ingreso
 * - Desviación estándar
 * - Frecuencia
 */
export const getMovementStatistics = async (userId: string) => {
  try {
    const movements = await prisma.movement.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        movementType: true,
      },
    });

    if (movements.length === 0) {
      return {
        totalMovements: 0,
        incomeCount: 0,
        expenseCount: 0,
        averageIncome: 0,
        averageExpense: 0,
        medianIncome: 0,
        medianExpense: 0,
        stdDevIncome: 0,
        stdDevExpense: 0,
      };
    }

    const incomeMovements = movements
      .filter((m) => m.movementType.code === 'INCOME')
      .map((m) => Number(m.amount));

    const expenseMovements = movements
      .filter((m) => m.movementType.code === 'EXPENSE')
      .map((m) => Number(m.amount));

    // Funciones auxiliares para estadísticas
    const calculateAverage = (arr: number[]) => {
      if (arr.length === 0) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    };

    const calculateMedian = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const calculateStdDev = (arr: number[], mean: number) => {
      if (arr.length === 0) return 0;
      const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
      return Math.sqrt(variance);
    };

    const avgIncome = calculateAverage(incomeMovements);
    const avgExpense = calculateAverage(expenseMovements);
    const medianIncome = calculateMedian(incomeMovements);
    const medianExpense = calculateMedian(expenseMovements);
    const stdDevIncome = calculateStdDev(incomeMovements, avgIncome);
    const stdDevExpense = calculateStdDev(expenseMovements, avgExpense);

    return {
      totalMovements: movements.length,
      incomeCount: incomeMovements.length,
      expenseCount: expenseMovements.length,
      averageIncome: parseFloat(avgIncome.toFixed(2)),
      averageExpense: parseFloat(avgExpense.toFixed(2)),
      medianIncome: parseFloat(medianIncome.toFixed(2)),
      medianExpense: parseFloat(medianExpense.toFixed(2)),
      stdDevIncome: parseFloat(stdDevIncome.toFixed(2)),
      stdDevExpense: parseFloat(stdDevExpense.toFixed(2)),
    };
  } catch (error) {
    console.error('Error en getMovementStatistics:', error);
    throw error;
  }
};

/**
 * Compara movimientos entre dos períodos
 */
export const compareMonthlyTrend = async (userId: string, months: number = 3) => {
  try {
    const now = new Date();
    const monthlyData = [];

    for (let i = months - 1; i >= 0; i--) {
      const currentMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthMovements = await prisma.movement.findMany({
        where: {
          userId,
          movementDate: {
            gte: currentMonth,
            lt: nextMonth,
          },
          deletedAt: null,
        },
        include: {
          movementType: true,
        },
      });

      const totalIncome = monthMovements
        .filter((m) => m.movementType.code === 'INCOME')
        .reduce((sum, m) => sum + Number(m.amount), 0);

      const totalExpense = monthMovements
        .filter((m) => m.movementType.code === 'EXPENSE')
        .reduce((sum, m) => sum + Number(m.amount), 0);

      monthlyData.push({
        month: currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpense: parseFloat(totalExpense.toFixed(2)),
        balance: parseFloat((totalIncome - totalExpense).toFixed(2)),
        movementCount: monthMovements.length,
      });
    }

    return monthlyData;
  } catch (error) {
    console.error('Error en compareMonthlyTrend:', error);
    throw error;
  }
};

/**
 * Obtiene análisis de categorías
 */
export const getCategoryAnalysis = async (userId: string) => {
  try {
    const movements = await prisma.movement.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        category: true,
        movementType: true,
      },
    });

    const categoryAnalysis = movements.reduce(
      (acc: any, m) => {
        const catKey = m.categoryId;
        if (!acc[catKey]) {
          acc[catKey] = {
            categoryId: m.categoryId,
            categoryName: m.category.name,
            income: 0,
            expense: 0,
            movementCount: 0,
          };
        }

        acc[catKey].movementCount += 1;
        if (m.movementType.code === 'INCOME') {
          acc[catKey].income += Number(m.amount);
        } else {
          acc[catKey].expense += Number(m.amount);
        }

        return acc;
      },
      {}
    );

    const result = Object.values(categoryAnalysis)
      .map((cat: any) => ({
        ...cat,
        income: parseFloat(cat.income.toFixed(2)),
        expense: parseFloat(cat.expense.toFixed(2)),
        balance: parseFloat((cat.income - cat.expense).toFixed(2)),
        percentage: 0, // Se calcula después
      }))
      .sort((a: any, b: any) => b.movementCount - a.movementCount);

    // Calcular porcentaje
    const totalMovements = result.reduce((sum: number, cat: any) => sum + cat.movementCount, 0);
    result.forEach((cat: any) => {
      cat.percentage = parseFloat(((cat.movementCount / totalMovements) * 100).toFixed(2));
    });

    return result;
  } catch (error) {
    console.error('Error en getCategoryAnalysis:', error);
    throw error;
  }
};

/**
 * Obtiene proyecciones basadas en promedios
 */
export const getProjection = async (userId: string, monthsAhead: number = 3) => {
  try {
    const stats = await getMovementStatistics(userId);
    const monthlyTrend = await compareMonthlyTrend(userId, 3);

    if (monthlyTrend.length === 0) {
      return {
        projections: [],
        confidence: 'low',
      };
    }

    const avgMonthlyIncome =
      monthlyTrend.reduce((sum, m) => sum + m.totalIncome, 0) / monthlyTrend.length;
    const avgMonthlyExpense =
      monthlyTrend.reduce((sum, m) => sum + m.totalExpense, 0) / monthlyTrend.length;

    const projections = [];
    const now = new Date();

    for (let i = 1; i <= monthsAhead; i++) {
      const projectionMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
      projections.push({
        month: projectionMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
        projectedIncome: parseFloat(avgMonthlyIncome.toFixed(2)),
        projectedExpense: parseFloat(avgMonthlyExpense.toFixed(2)),
        projectedBalance: parseFloat((avgMonthlyIncome - avgMonthlyExpense).toFixed(2)),
      });
    }

    return {
      projections,
      confidence: stats.totalMovements > 12 ? 'high' : stats.totalMovements > 6 ? 'medium' : 'low',
      baselineMonths: monthlyTrend.length,
    };
  } catch (error) {
    console.error('Error en getProjection:', error);
    throw error;
  }
};
