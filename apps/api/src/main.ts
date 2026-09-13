import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS is required now that the browser frontend (Vite dev server on
  // localhost:5173) calls this API on localhost:3000. Without it, the browser
  // blocks the fetch as a cross-origin request.
  app.enableCors({
    origin: ['http://localhost:5173'],
  });

  // Global ValidationPipe runs for EVERY route in the app.
  //  - whitelist:true strips any property that has no DTO decorator, which
  //    blocks mass-assignment attacks (e.g. POST /users {"role":"admin"}).
  //  - transform:true converts the plain JSON body INTO a real CreateUserDto
  //    class instance so class-validator's decorators can operate on it, and
  //    enables automatic type coercion of primitives.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
