import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: config.getOrThrow<string>('FRONTEND_URL'), credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CPDS API')
      .setDescription('Counterfeit Product Detection System')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port);
  console.log(`CPDS API running on http://localhost:${port}/api/v1 (docs: /api/docs)`);
}
bootstrap();
