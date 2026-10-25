import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadConfig } from './config/app-config';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('invictus-authnet').setDescription('Authorize.net sandbox payments').setVersion('0.1.0').build(),
  );
  SwaggerModule.setup('docs', app, doc);
  await app.listen(config.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`Listening on port ${config.PORT} (Swagger docs at /docs)`);
}
void bootstrap();
