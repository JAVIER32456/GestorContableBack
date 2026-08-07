import express from 'express';
import type { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  getDashboardSummary,
  getHighestMovement,
  getMovementsByType,
  getMovementsSummaryByDateRange,
} from '../services/dashboardService.js';
import {
  getMovementStatistics,
  compareMonthlyTrend,
  getCategoryAnalysis,
  getProjection,
} from '../services/statisticsService.js';
import { getReportData, getUserReports, compareReports } from '../services/reportService.js';

const router: Router = express.Router();

/**
 * GET /api/dashboard/home?userId=123&period=this_month
 * Obtiene el resumen completo del dashboard
 */
router.get('/home', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, period } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const summary = await getDashboardSummary(userId, period || 'this_month');

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error en /dashboard/home:', error);
    res.status(500).json({ error: 'Error al obtener resumen del dashboard' });
  }
});

/**
 * GET /api/dashboard/statistics?userId=123
 * Obtiene estadísticas detalladas de movimientos
 */
router.get('/statistics', verifyToken, async (req: any, res: any) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const stats = await getMovementStatistics(userId);
    const monthlyTrend = await compareMonthlyTrend(userId, 6);
    const categoryAnalysis = await getCategoryAnalysis(userId);

    res.json({
      success: true,
      data: {
        statistics: stats,
        monthlyTrend,
        categoryAnalysis,
      },
    });
  } catch (error) {
    console.error('Error en /dashboard/statistics:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/dashboard/highest-movement?userId=123
 * Obtiene el movimiento con el mayor valor
 */
router.get('/highest-movement', verifyToken, async (req: any, res: any) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const movement = await getHighestMovement(userId);

    res.json({
      success: true,
      data: movement,
    });
  } catch (error) {
    console.error('Error en /dashboard/highest-movement:', error);
    res.status(500).json({ error: 'Error al obtener movimiento de mayor valor' });
  }
});

/**
 * GET /api/dashboard/income?userId=123&limit=10
 * Obtiene los ingresos del usuario
 */
router.get('/income', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const movements = await getMovementsByType(userId, 'INCOME', limit || 10);

    res.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    console.error('Error en /dashboard/income:', error);
    res.status(500).json({ error: 'Error al obtener ingresos' });
  }
});

/**
 * GET /api/dashboard/expense?userId=123&limit=10
 * Obtiene los gastos del usuario
 */
router.get('/expense', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const movements = await getMovementsByType(userId, 'EXPENSE', limit || 10);

    res.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    console.error('Error en /dashboard/expense:', error);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

/**
 * GET /api/dashboard/date-range?userId=123&startDate=2024-01-01&endDate=2024-01-31
 * Obtiene resumen de movimientos entre fechas
 */
router.get('/date-range', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, startDate, endDate } = req.query;

    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: 'userId, startDate y endDate son requeridos' });
    }

    const summary = await getMovementsSummaryByDateRange(
      userId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error en /dashboard/date-range:', error);
    res.status(500).json({ error: 'Error al obtener resumen por rango de fechas' });
  }
});

/**
 * GET /api/dashboard/projection?userId=123&monthsAhead=3
 * Obtiene proyección de movimientos futuros
 */
router.get('/projection', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, monthsAhead } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const projection = await getProjection(userId, monthsAhead || 3);

    res.json({
      success: true,
      data: projection,
    });
  } catch (error) {
    console.error('Error en /dashboard/projection:', error);
    res.status(500).json({ error: 'Error al obtener proyección' });
  }
});

/**
 * GET /api/dashboard/report-data?userId=123&reportType=monthly&year=2024&month=0
 * Obtiene datos para un reporte
 */
router.get('/report-data', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, reportType, year, month } = req.query;

    if (!userId || !reportType) {
      return res.status(400).json({ error: 'userId y reportType son requeridos' });
    }

    const reportData = await getReportData(
      userId,
      reportType,
      year ? parseInt(year) : new Date().getFullYear(),
      month ? parseInt(month) : 0
    );

    res.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error('Error en /dashboard/report-data:', error);
    res.status(500).json({ error: 'Error al obtener datos del reporte' });
  }
});

/**
 * GET /api/dashboard/reports?userId=123&page=1&limit=10
 * Obtiene lista de reportes del usuario
 */
router.get('/reports', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, page, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }

    const reports = await getUserReports(userId, page || 1, limit || 10);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error('Error en /dashboard/reports:', error);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

/**
 * GET /api/dashboard/compare-reports?userId=123&reportType=monthly&year=2024&period1=0&period2=1
 * Compara dos períodos
 */
router.get('/compare-reports', verifyToken, async (req: any, res: any) => {
  try {
    const { userId, reportType, year, period1, period2 } = req.query;

    if (!userId || !reportType || period1 === undefined || period2 === undefined) {
      return res.status(400).json({
        error: 'userId, reportType, period1 y period2 son requeridos',
      });
    }

    const comparison = await compareReports(
      userId,
      reportType,
      year ? parseInt(year) : new Date().getFullYear(),
      parseInt(period1),
      parseInt(period2)
    );

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('Error en /dashboard/compare-reports:', error);
    res.status(500).json({ error: 'Error al comparar reportes' });
  }
});

export default router;
