# Урок 02 — PostgreSQL, Prisma і постійні дані

## Головна ідея

Спочатку API зберігав конфігурації просто в масиві всередині Node.js. Після перезапуску сервера такі дані зникали. Тому ми підключили **PostgreSQL** — постійну базу даних.

Шлях запиту тепер такий:

```text
Browser → NestJS controller → service → Prisma Client → PostgreSQL
```

## Основні терміни

- **PostgreSQL** — реляційна база даних, яка зберігає інформацію навіть після перезапуску API або ПК.
- **Prisma** — ORM: прошарок між TypeScript і PostgreSQL. Ми працюємо з типізованими методами Prisma замість ручного написання SQL у кожному service.
- **Model** — опис сутності в `prisma/schema.prisma`, наприклад `User`, `ConfigEntry`, `Workspace`.
- **Migration** — версійована зміна структури БД: нова таблиця, колонка, enum, index тощо.
- **Seed** — початкові demo-дані, які можна додати в чисту базу.

## Приклад

Маємо параметр:

```text
limits.maxTasksPerUser = 50
```

Після збереження Prisma виконує запис у PostgreSQL. Тому навіть після:

```powershell
Ctrl+C
npm run dev
```

значення не зникає.

## Навіщо потрібен unique constraint

Для конфігурації ми не хочемо двох однакових ключів у тому самому project/environment. Це правило краще тримати не лише в UI, а й у БД.

Приклад:

```text
project = flowline-service
environment = staging
name = limits.maxTasksPerUser
```

Другий такий запис база повинна відхилити.

## Що варто сказати на співбесіді

> PostgreSQL є джерелом правди, Prisma дає типізований доступ до БД, а schema changes я проводжу через versioned migrations.
