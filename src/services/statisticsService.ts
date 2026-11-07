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
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const monthTotals = new Map<string, {
      month: string;
      totalIncome: number;
      totalExpense: number;
      movementCount: number;
    }>();

    for (let i = 0; i < months; i++) {
      const currentMonth = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      monthTotals.set(monthKey, {
        month: currentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
        totalIncome: 0,
        totalExpense: 0,
        movementCount: 0,
      });
    }

    const movements = await prisma.movement.findMany({
      where: {
        userId,
        deletedAt: null,
        movementDate: {
          gte: firstMonth,
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      select: {
        amount: true,
        movementDate: true,
        movementType: {
          select: {
            code: true,
          },
        },
      },
    });

    for (const movement of movements) {
      const monthKey = `${movement.movementDate.getFullYear()}-${String(movement.movementDate.getMonth() + 1).padStart(2, '0')}`;
      const totals = monthTotals.get(monthKey);
      if (!totals) continue;

      if (movement.movementType.code === 'INCOME') {
        totals.totalIncome += Number(movement.amount);
      } else if (movement.movementType.code === 'EXPENSE') {
        totals.totalExpense += Number(movement.amount);
      }
      totals.movementCount += 1;
    }

    return Array.from(monthTotals.values(), (totals) => ({
      ...totals,
      totalIncome: parseFloat(totals.totalIncome.toFixed(2)),
      totalExpense: parseFloat(totals.totalExpense.toFixed(2)),
      balance: parseFloat((totals.totalIncome - totals.totalExpense).toFixed(2)),
    }));
  } catch (error) {
    console.error('Error en compareMonthlyTrend:', error);
    throw error;
  }
};

export const getCumulativeBalanceTrend = async (userId: string, months: number = 6) => {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const endNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [incomeBeforePeriod, expensesBeforePeriod, movements] = await prisma.$transaction([
    prisma.movement.aggregate({
      where: {
        userId,
        deletedAt: null,
        movementType: { code: 'INCOME' },
        movementDate: { lt: firstMonth },
      },
      _sum: { amount: true },
    }),
    prisma.movement.aggregate({
      where: {
        userId,
        deletedAt: null,
        movementType: { code: 'EXPENSE' },
        movementDate: { lt: firstMonth },
      },
      _sum: { amount: true },
    }),
    prisma.movement.findMany({
      where: {
        userId,
        deletedAt: null,
        movementDate: { gte: firstMonth, lt: endNextMonth },
      },
      select: {
        amount: true,
        movementDate: true,
        movementType: { select: { code: true } },
      },
    }),
  ]);

  const monthlyTotals = new Map<string, {
    month: string;
    monthlyIncome: number;
    monthlyExpenses: number;
  }>();

  for (let i = 0; i < months; i++) {
    const monthStart = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals.set(monthKey, {
      month: monthStart.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
      monthlyIncome: 0,
      monthlyExpenses: 0,
    });
  }

  for (const movement of movements) {
    const monthKey = `${movement.movementDate.getFullYear()}-${String(movement.movementDate.getMonth() + 1).padStart(2, '0')}`;
    const totals = monthlyTotals.get(monthKey);
    if (!totals) continue;

    if (movement.movementType.code === 'INCOME') {
      totals.monthlyIncome += Number(movement.amount);
    } else if (movement.movementType.code === 'EXPENSE') {
      totals.monthlyExpenses += Number(movement.amount);
    }
  }

  let totalBalance =
    Number(incomeBeforePeriod._sum.amount ?? 0) -
    Number(expensesBeforePeriod._sum.amount ?? 0);

  return Array.from(monthlyTotals.values(), (totals) => {
    const monthlyBalance = totals.monthlyIncome - totals.monthlyExpenses;
    totalBalance += monthlyBalance;

    return {
      month: totals.month,
      monthlyIncome: Number(totals.monthlyIncome.toFixed(2)),
      monthlyExpenses: Number(totals.monthlyExpenses.toFixed(2)),
      monthlyBalance: Number(monthlyBalance.toFixed(2)),
      totalBalance: Number(totalBalance.toFixed(2)),
    };
  });
};

export const getFinancialSummary = async (userId: string) => {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalIncome,
    totalExpenses,
    monthlyIncome,
    monthlyExpenses,
    annualIncome,
    annualExpenses,
  ] = await prisma.$transaction([
    prisma.movement.aggregate({
      where: { userId, deletedAt: null, movementType: { code: 'INCOME' } },
      _sum: { amount: true },
    }),
    prisma.movement.aggregate({
      where: { userId, deletedAt: null, movementType: { code: 'EXPENSE' } },
      _sum: { amount: true },
    }),
    prisma.movement.aggregate({
      where: {
        userId,
        deletedAt: null,
        movementType: { code: 'INCOME' },
        movementDate: { gte: startMonth, lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
      },
      _sum: { amount: true },
    }),
    prisma.movement.aggregate({
      where: {
        userId,
        deletedAt: null,
        movementType: { code: 'EXPENSE' },
        movementDate: { gte: startMonth, lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
      },
      _sum: { amount: true },
    }),
    prisma.movement.aggregate({
      where: {
        userId,
        deletedAt: null,
        movementType: { code: 'INCOME' },
        movementDate: { gte: startYear, lt: new Date(now.getFullYear() + 1, 0, 1) },
      },
      _sum: { amount: true },
    }),
    prisma.movement.aggregate({
      where: {
        userId,
        deletedAt: null,
        movementType: { code: 'EXPENSE' },
        movementDate: { gte: startYear, lt: new Date(now.getFullYear() + 1, 0, 1) },
      },
      _sum: { amount: true },
    }),
  ]);

  const totalIncomeAmount = Number(totalIncome._sum.amount ?? 0);
  const totalExpensesAmount = Number(totalExpenses._sum.amount ?? 0);
  const monthlyIncomeAmount = Number(monthlyIncome._sum.amount ?? 0);
  const monthlyExpensesAmount = Number(monthlyExpenses._sum.amount ?? 0);
  const annualIncomeAmount = Number(annualIncome._sum.amount ?? 0);
  const annualExpensesAmount = Number(annualExpenses._sum.amount ?? 0);

  return {
    totalIncome: totalIncomeAmount,
    totalExpenses: totalExpensesAmount,
    totalNetBalance: totalIncomeAmount - totalExpensesAmount,
    monthlyIncome: monthlyIncomeAmount,
    monthlyExpenses: monthlyExpensesAmount,
    monthlyNetBalance: monthlyIncomeAmount - monthlyExpensesAmount,
    annualIncome: annualIncomeAmount,
    annualExpenses: annualExpensesAmount,
    annualNetBalance: annualIncomeAmount - annualExpensesAmount,
    monthlySavingsRate: monthlyIncomeAmount === 0
      ? 0
      : ((monthlyIncomeAmount - monthlyExpensesAmount) / monthlyIncomeAmount) * 100,
    annualSavingsRate: annualIncomeAmount === 0
      ? 0
      : ((annualIncomeAmount - annualExpensesAmount) / annualIncomeAmount) * 100,
  };
};

export const getCategoryDistribution = async (
  userId: string,
  movementType: 'INCOME' | 'EXPENSE',
  startDate: Date,
  endDate: Date,
) => {
  const groupedMovements = await prisma.movement.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      deletedAt: null,
      movementType: { code: movementType },
      movementDate: { gte: startDate, lt: endDate },
    },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  const categories = await prisma.category.findMany({
    where: { id: { in: groupedMovements.map((item) => item.categoryId) } },
    select: { id: true, name: true },
  });
  const totalAmount = groupedMovements.reduce(
    (sum, item) => sum + Number(item._sum.amount ?? 0),
    0,
  );

  return groupedMovements.map((item) => {
    const amount = Number(item._sum.amount ?? 0);
    return {
      categoryId: item.categoryId,
      category: categories.find((category) => category.id === item.categoryId)?.name ?? 'Sin categoría',
      amount,
      transactions: item._count.id,
      percentage: totalAmount === 0 ? 0 : (amount / totalAmount) * 100,
    };
  });
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
