import prisma from '../prisma.js';

/**
 * Obtiene información para generar un reporte
 */
export const getReportData = async (
  userId: string,
  reportType: 'monthly' | 'quarterly' | 'annual',
  year: number = new Date().getFullYear(),
  month?: number
) => {
  try {
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (reportType === 'monthly' && month !== undefined) {
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0);
      periodLabel = new Date(year, month).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    } else if (reportType === 'quarterly') {
      const quarter = Math.floor((month || 0) / 3);
      startDate = new Date(year, quarter * 3, 1);
      endDate = new Date(year, quarter * 3 + 3, 0);
      periodLabel = `Q${quarter + 1} ${year}`;
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      periodLabel = year.toString();
    }

    // Obtener usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Obtener movimientos en el período
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
        category: true,
        movementType: true,
      },
      orderBy: {
        movementDate: 'desc',
      },
    });

    // Calcular resumen
    const totalIncome = movements
      .filter((m) => m.movementType.code === 'INCOME')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const totalExpense = movements
      .filter((m) => m.movementType.code === 'EXPENSE')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    // Agrupar por categoría
    const categoryBreakdown = movements.reduce(
      (acc: any, m) => {
        const catKey = m.categoryId;
        if (!acc[catKey]) {
          acc[catKey] = {
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

    const categories = Object.entries(categoryBreakdown).map(([_, data]: [string, any]) => ({
      name: data.categoryName,
      income: parseFloat(data.income.toFixed(2)),
      expense: parseFloat(data.expense.toFixed(2)),
      balance: parseFloat((data.income - data.expense).toFixed(2)),
      movementCount: data.movementCount,
    }));

    return {
      report: {
        type: reportType,
        period: periodLabel,
        startDate,
        endDate,
        generatedAt: new Date(),
      },
      user,
      summary: {
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpense: parseFloat(totalExpense.toFixed(2)),
        balance: parseFloat((totalIncome - totalExpense).toFixed(2)),
        totalMovements: movements.length,
      },
      categories: categories.sort((a, b) => b.expense - a.expense),
      movements: movements.map((m) => ({
        id: m.id,
        date: m.movementDate,
        category: m.category.name,
        type: m.movementType.code,
        description: m.description,
        amount: parseFloat(Number(m.amount).toFixed(2)),
      })),
    };
  } catch (error) {
    console.error('Error en getReportData:', error);
    throw error;
  }
};

/**
 * Obtiene lista de reportes guardados
 */
export const getUserReports = async (userId: string, page: number = 1, limit: number = 10) => {
  try {
    const skip = (page - 1) * limit;

    const [total, reports] = await prisma.$transaction([
      prisma.report.count({
        where: { userId },
      }),
      prisma.report.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      reports: reports.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        reportType: r.reportType,
        startDate: r.startDate,
        endDate: r.endDate,
        createdAt: r.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error en getUserReports:', error);
    throw error;
  }
};

/**
 * Crea un nuevo reporte
 */
export const createReport = async (
  userId: string,
  fileName: string,
  filePath: string,
  pdfUrl: string,
  reportType: string,
  startDate: Date,
  endDate: Date
) => {
  try {
    const report = await prisma.report.create({
      data: {
        userId,
        fileName,
        filePath,
        pdfUrl,
        reportType,
        startDate,
        endDate,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return report;
  } catch (error) {
    console.error('Error en createReport:', error);
    throw error;
  }
};

/**
 * Elimina un reporte
 */
export const deleteReport = async (reportId: string, userId: string) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report || report.userId !== userId) {
      throw new Error('Reporte no encontrado o no tienes permisos');
    }

    await prisma.report.delete({
      where: { id: reportId },
    });

    return { message: 'Reporte eliminado correctamente' };
  } catch (error) {
    console.error('Error en deleteReport:', error);
    throw error;
  }
};

/**
 * Obtiene comparativa entre períodos
 */
export const compareReports = async (
  userId: string,
  reportType: 'monthly' | 'quarterly' | 'annual',
  year: number,
  period1: number,
  period2: number
) => {
  try {
    const report1 = await getReportData(userId, reportType, year, period1);
    const report2 = await getReportData(userId, reportType, year, period2);

    return {
      report1: report1.summary,
      report2: report2.summary,
      comparison: {
        incomeVariation: parseFloat(
          ((report2.summary.totalIncome - report1.summary.totalIncome) / report1.summary.totalIncome * 100).toFixed(2)
        ),
        expenseVariation: parseFloat(
          ((report2.summary.totalExpense - report1.summary.totalExpense) / report1.summary.totalExpense * 100).toFixed(2)
        ),
        balanceVariation: report2.summary.balance - report1.summary.balance,
      },
    };
  } catch (error) {
    console.error('Error en compareReports:', error);
    throw error;
  }
};
