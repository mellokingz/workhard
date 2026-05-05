import 'dotenv/config';
import app from './app.js';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // Test DB connection
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Nexus Study API running on port ${PORT}`);
    logger.info(`📖 Docs: http://localhost:${PORT}/api/health`);
    logger.info(`🌍 ENV: ${process.env.NODE_ENV}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('💤 Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });
}

bootstrap();
