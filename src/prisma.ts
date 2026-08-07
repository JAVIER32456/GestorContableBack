import { PrismaClient } from './generated/client/index.js';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export default prisma;


