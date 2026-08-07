import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import prisma from './prisma.js';
import userRoutes from './routes/users.js';
import movement   from './routes/movement.js';
import auditLog    from './routes/auditLog.js';
import categoryRoutes from './routes/category.js';
import movementTypeRoutes from './routes/movementType.js';
import datahome from './routes/datahome.js';
import reportRoutes from './routes/report.js';
import dashboardRoutes from './routes/dashboard.js';
import authRoutes from './routes/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app: Express = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/audit', auditLog);
app.use('/api/users', userRoutes);
app.use('/api/movement', movement);
app.use('/api/reports', reportRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/movement-types', movementTypeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.get('/api/movement/form-data', movement);
app.use('/api/datahome', datahome);


// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running ✅' });
});

// Manejo de rutas no encontradas (404)
app.use(notFoundHandler);

// Manejo centralizado de errores (debe estar al final)
app.use(errorHandler);

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});

export default app;
