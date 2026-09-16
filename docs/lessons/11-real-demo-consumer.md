# Урок 11 — Реальний consumer runtime-конфігурації

## Flowline Dispatch

`/demo` тепер виглядає як окремий продукт **Flowline Dispatch**, а не сторінка OpsPilot Admin.

Його задача — показати, що runtime values реально змінюють поведінку іншого React UI.

## `limits.maxTasksPerUser`

У Dispatch можна створювати tasks. Коли кількість активних задач досягає published limit, кнопка `New task` блокується.

Приклад:

```text
limit = 3
active tasks = 3
→ створювати нові не можна
```

## `service.maintenanceMode`

При `true` продукт переходить у read-only:

```text
create task     disabled
send digest     disabled
carrier sync    disabled
```

## `notifications.weeklyDigest`

Це **feature flag**.

```text
true  → функція доступна
false → функція вимкнена
```

## `limits.maxRetries`

Carrier Sync симулює нестабільний зовнішній API. Перші три спроби падають, четверта успішна.

```text
maxRetries = 1 → 2 total attempts → fail
maxRetries = 3 → 4 total attempts → success
```

Це показує, що operational policy можна змінювати через runtime config без зміни consumer-коду.

## End-to-end ланцюжок

```text
OpsPilot Draft
  ↓
Approval
  ↓
Publish
  ↓
PostgreSQL transaction
  ↓
Redis invalidation
  ↓
Runtime API
  ↓
Flowline Dispatch changes behavior
```

## Головна цінність для портфоліо

Рекрутер бачить не ізольований CRUD, а повний product flow: security, workflow, versioning, cache і реальний consumer.

## Що сказати на співбесіді

> Flowline Dispatch — окремий consumer runtime API, який демонструє feature flags, dynamic limits, maintenance mode і retry policy без redeploy самого consumer-а.
