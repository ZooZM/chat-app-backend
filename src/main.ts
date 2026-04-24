import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { GlobalResponseInterceptor } from './common/interceptors/global-response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  // Ensure the uploads directory exists before accepting requests.
  mkdirSync(join(process.cwd(), 'uploads'), { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve /uploads as a static folder so Flutter can fetch media via GET /uploads/<file>.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Configure WebSocket Redis Adapter
  const redisIoAdapter = new RedisIoAdapter(app);
  app.useWebSocketAdapter(redisIoAdapter);

  // 1. Attack surface reduction (HTTP headers)
  app.use(helmet());

  // 2. Strict CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3. Global Validation Pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strips non-whitelisted properties from DTOs
      forbidNonWhitelisted: true,     // Rejects raw requests containing unknown properties
      transform: true,              // Transforms payloads to class instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 4. Global Interceptors & Filters
  app.useGlobalInterceptors(new GlobalResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // NOTE: Rate Limiting with Redis is best configured using ThrottlerModule directly 
  // in the AppModule rather than main.ts for better Dependency Injection lifecycle support.

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Chat API is running on: http://localhost:${port}`);
}
bootstrap();
