import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/app-config';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  await app.listen(config.PORT, '0.0.0.0');
}
void bootstrap();
