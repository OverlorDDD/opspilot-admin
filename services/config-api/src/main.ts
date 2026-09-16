import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS ?? "http://localhost:3000";
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  app.use(cookieParser());

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Allows NestJS to close database/Redis connections cleanly on SIGTERM.
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`OpsPilot API listening on port ${port}`);
}

void bootstrap();
