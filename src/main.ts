import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Prefix
  app.setGlobalPrefix('api/admin');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 Grayskull ADMIN BACKOFFICE                     ║
╠══════════════════════════════════════════════════════════════╣
║  🔐 Admin API running on: http://localhost:${port}/api/admin     ║
║  📊 Tenant Management                                        ║
║  💳 Subscription & Billing                                   ║
║  🔧 Module Provisioning                                      ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
