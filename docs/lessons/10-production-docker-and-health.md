# Урок 10 — Production Docker, health checks і environment variables

## Development і production — різні режими

Для розробки:

```powershell
npm run dev
```

Dev-mode має watch/rebuild і зручні diagnostics.

Production-процес:

```text
source code → build → Docker image → container
```

## Docker image і container

**Image** — запакований шаблон застосунку: runtime, dependencies, build output і start command.

**Container** — запущений instance цього image.

## Наш production-like stack

```text
PostgreSQL → migrate → seed → NestJS API → Next.js Web
                  ↘ Redis ↗
```

`migrate` і `seed` — one-shot containers: виконують задачу і завершуються.

## `prisma migrate deploy`

У production ми застосовуємо вже створені migrations:

```text
prisma migrate deploy
```

`migrate dev` потрібен розробнику для створення нової migration; `deploy` — серверу для застосування готової.

## Health checks

**Liveness**:

```text
GET /api/health/live
```

показує, чи живий процес.

**Readiness**:

```text
GET /api/health/ready
```

показує, чи сервіс реально готовий приймати traffic, наприклад чи бачить PostgreSQL.

Redis може бути `degraded`, але API залишається ready завдяки fallback.

## Environment variables

Секрети та адреси не повинні бути зашиті в image:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
CORS_ORIGINS
COOKIE_SECURE
```

Той самий Docker image можна запускати локально та в AWS із різними env values.

## Що сказати на співбесіді

> Сервіси контейнеризовані multi-stage Docker builds, schema migrations запускаються окремим one-shot step, а liveness/readiness endpoints використовуються для orchestration.
