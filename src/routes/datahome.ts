import express from "express";
import type { Router } from "express";
import prisma from "../prisma.js";
import { verifyToken } from "../middleware/auth.js";

const router: Router = express.Router();

router.get("/", verifyToken, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    // ==========================
    // Fechas del mes actual
    // ==========================
    const today = new Date();

    const startMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const endMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1
    );

    // ==========================
    // Consultas
    // ==========================
    const [
      totalIncome,
      totalExpenses,
      monthlyMovements,
      recentMovements,
    ] = await prisma.$transaction([

      // INGRESOS TOTALES
      prisma.movement.aggregate({
        where: {
          userId,
          deletedAt: null,
          movementType: {
            code: "INCOME",
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // GASTOS TOTALES
      prisma.movement.aggregate({
        where: {
          userId,
          deletedAt: null,
          movementType: {
            code: "EXPENSE",
          },
        },
        _sum: {
          amount: true,
        },
      }),

      // MOVIMIENTOS DEL MES
      prisma.movement.count({
        where: {
          userId,
          deletedAt: null,
          movementDate: {
            gte: startMonth,
            lt: endMonth,
          },
        },
      }),

      // ÚLTIMOS 4 MOVIMIENTOS
      prisma.movement.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        include: {
          category: {
            select: {
              name: true,
            },
          },
          movementType: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          movementDate: "desc",
        },
        take: 4,
      }),

      
      
    ]);
    
    // TOP 3 GASTOS MÁS ALTOS
    const groupedExpenses = await prisma.movement.groupBy({
        by: ["categoryId"],
        where: {
            userId,
            deletedAt: null,
            movementType: {
            code: "EXPENSE",
            },
            movementDate: {
            gte: startMonth,
            lt: endMonth,
            },
        },
        _sum: {
            amount: true,
        },
        _count: {
            id: true,
        },
        orderBy: {
            _sum: {
            amount: "desc",
            },
        },
        take: 3,
    });

    const categories = await prisma.category.findMany({
        where: {
            id: {
            in: groupedExpenses.map((g) => g.categoryId),
            },
        },
        select: {
            id: true,
            name: true,
        },
    });

    const topExpenses = groupedExpenses.map((expense) => ({
        categoryId: expense.categoryId,
        category: categories.find(
            (c) => c.id === expense.categoryId
        ),
        total: Number(expense._sum.amount ?? 0),
        transactions: expense._count.id,
    }));

    // ==========================
    // Saldo actual
    // ==========================

    const currentBalance =
      Number(totalIncome._sum.amount ?? 0) -
      Number(totalExpenses._sum.amount ?? 0);

    // ==========================
    // Respuesta
    // ==========================

    res.json({
      success: true,
      data: {
        currentBalance,
        totalIncome: Number(totalIncome._sum.amount ?? 0),
        totalExpenses: Number(totalExpenses._sum.amount ?? 0),
        monthlyMovements,
        topExpenses,
        recentMovements,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Error al obtener datos del dashboard",
    });
  }
});

export default router;