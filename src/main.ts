import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor';
import { GlobalExceptionHandler } from './exceptions/global-exception-handler';
import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import helmet from 'helmet';

async function bootstrap() {
  const isProduction: boolean = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(
          ({ timestamp, level, context, message }) =>
            `[${timestamp}] [${level}] [${context}] ${message}`,
        ),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/app.log',
        }),
      ],
      level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    }),
  });

  // Swagger UI не совместим со строгим CSP, поэтому вне продакшена CSP выключен.
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  app.useGlobalFilters(new GlobalExceptionHandler());

  const corsOrigins: string[] = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  if (!isProduction || process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Food Delivery API')
      .setDescription('REST API for Food Delivery Service')
      .setVersion('1.0.12')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('swagger', app, document);
  }

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
