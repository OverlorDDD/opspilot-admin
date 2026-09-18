# Урок 14. Persistent Dispatch і central control plane

## Навіщо цей етап

Раніше Flowline Dispatch добре показував runtime configuration, але частина поведінки була лише React-симуляцією. Нові задачі жили тільки в `useState`, тому після F5 зникали.

На цьому етапі ми робимо дві важливі речі:

1. Flowline Dispatch стає маленьким реальним full-stack продуктом.
2. OpsPilot стає central control plane для кількох продуктів однієї компанії.

## Workspace і Project

У нашій моделі:

- **Workspace** — компанія або організація.
- **Project** — окремий продукт/сервіс цієї компанії.

Наприклад:

```text
Flowline Operations workspace
├── Flowline Dispatch
└── Flowline Customer Portal
```

Це пояснює, навіщо окремий OpsPilot. Компанії не потрібно в кожному продукті окремо реалізовувати ролі, approval, audit, rollback, feature flags і environments.

## Persistent data

Тепер Dispatch зберігає:

- задачі у PostgreSQL;
- завершення задач;
- digest events;
- carrier sync events.

React більше не є джерелом правди для work queue.

Потік створення задачі:

```text
React
→ POST /api/demo/dispatch/tasks
→ NestJS DispatchService
→ runtime policy check
→ Prisma
→ PostgreSQL
→ response
→ React reloads state
```

Після F5 React робить GET до backend і знову отримує задачі з PostgreSQL.

## Runtime config реально змінює backend behavior

### limits.maxTasksPerUser

Перед створенням задачі NestJS рахує активні задачі. Якщо ліміт вичерпано, API повертає помилку і не записує нову задачу.

### service.maintenanceMode

Коли значення `true`, backend блокує:

- створення задач;
- завершення задач;
- weekly digest;
- carrier sync.

Навіть ручний HTTP-запит не обійде правило.

### notifications.weeklyDigest

Якщо flag вимкнений, endpoint digest відмовляється виконувати дію.

Якщо ввімкнений — backend створює persistent `DIGEST_QUEUED` event.

### limits.maxRetries

Carrier API у демо навмисно повертає 503 на перші три спроби.

`maxRetries = 2`:

```text
Attempt 1 → 503
Retry 1   → 503
Retry 2   → 503
STOP
```

`maxRetries = 3`:

```text
Attempt 1 → 503
Retry 1   → 503
Retry 2   → 503
Retry 3   → 200 OK
```

Тобто retry — це повтор після першої спроби. Три retries означають максимум чотири attempts.

## Чому прибрали Save draft

Раніше editor:

```text
Start draft
→ edit
→ Save draft
→ Submit for approval
```

Тепер:

```text
Start draft
→ edit
→ Submit for approval
```

Submit надсилає поточні value/description на NestJS. Backend в одній транзакції:

1. записує значення у revision;
2. переводить її в PENDING_APPROVAL;
3. створює audit event.

Це коротший UX і менше шансів відправити стару незбережену версію.

## User management і tenant isolation

Кнопку Users бачать тільки `owner/admin`.

Backend endpoint також захищений roles guard.

Крім того, список тепер scoped до поточного workspace. Admin однієї компанії не повинен бачити email-и іншої компанії.

Це називається **tenant isolation**.

## Що розповісти на співбесіді

Коротко:

> OpsPilot is a centralized control plane for multiple products and environments. Runtime policies are published through an approval workflow and enforced by the consuming service on the backend, not only in React. Flowline Dispatch persists its own domain data in PostgreSQL and uses OpsPilot runtime configuration to control task capacity, maintenance mode, digest availability and retry policy.

## Що протестувати руками

1. Перезавантажити /demo — задачі не зникають.
2. Створити task, F5 — task лишився.
3. Complete task, F5 — статус DONE лишився.
4. Поставити maxTasks нижче current active count, publish — New task блокується.
5. Увімкнути maintenanceMode — усі write actions блокуються.
6. Вимкнути weeklyDigest — backend не дозволяє queue digest.
7. maxRetries=2 — carrier sync fails.
8. maxRetries=3 — carrier sync succeeds on attempt 4.
9. F5 — activity history лишається.
10. В OpsPilot перемкнути Project і побачити інший набір configuration keys.
11. Зайти viewer/editor — Users не доступний.
12. Зайти owner/admin — Users доступний тільки в межах current workspace.
