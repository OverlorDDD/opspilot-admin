# Урок 16. Interview-ready hardening

Цей етап не додає ще одну бізнес-фічу. Він закриває production-oriented речі, про які часто питають на Middle Node.js/React interview.

## Persistent SDK snapshot

Раніше SDK тримав runtime config тільки в RAM.

Проблемний сценарій:

```text
OpsPilot unavailable
+
customer backend restarts
→ RAM snapshot lost
```

Тепер consumer може передати:

```ts
snapshotFile: "./var/opspilot-runtime.json"
maxStaleMs: 24 * 60 * 60 * 1000
```

Після успішного network refresh SDK атомарно записує snapshot на диск. Після restart новий Node process може відновити його з disk.

Stale config не можна довіряти безкінечно. `maxStaleMs` задає максимальний вік fallback snapshot.

## Service-key authentication cache

До hardening service key перевірявся через PostgreSQL на кожний runtime request, а `lastUsedAt` оновлювався так само часто.

Це означало, що Redis config cache не прибирав database load повністю.

Тепер:

```text
raw service key
→ SHA-256
→ Redis auth cache
   ├── HIT → context без PostgreSQL
   └── MISS → PostgreSQL → lastUsedAt → Redis SET (60s)
```

Revoke інвалідовує auth-cache цього key.

Тому при hot runtime traffic PostgreSQL не отримує authentication query на кожний request.

## Rate limiting

Зовнішній runtime endpoint захищений лімітом запитів на service key.

За замовчуванням:

```text
120 requests / minute / service key
```

Redis тримає короткий fixed-window counter.

Якщо limit перевищено:

```http
429 Too Many Requests
```

Ліміт прив'язаний до service key, а не лише до IP, тому credential має власний budget незалежно від NAT/мережі.

Якщо Redis degraded, runtime path fail-open: consumer availability важливіша за тимчасову неможливість застосувати rate limit.

## Request IDs і structured logs

Кожний API request отримує `x-request-id`.

Приклад log event:

```json
{
  "event": "http_request",
  "requestId": "...",
  "method": "GET",
  "path": "/api/runtime/v1/config",
  "statusCode": 200,
  "durationMs": 4.7
}
```

Request ID дозволяє зв'язати помилку клієнта з конкретним backend request.

## Load testing

У repository є:

```powershell
npm run loadtest:runtime
```

Він вимірює:

- total requests;
- concurrency;
- throughput;
- HTTP statuses;
- transport errors;
- p50 latency;
- p95 latency;
- p99 latency.

Не можна казати на interview "ми витримуємо X RPS", поки тест реально не запускався в задокументованому середовищі.

Якщо p95 = 40 ms, то приблизно 95% успішних виміряних requests завершились не повільніше ніж за 40 ms.

## README truthfulness

З README і architecture docs прибрані AWS, Terraform і SNS/SQS як уже реалізовані технології.

Це важливо для портфоліо: interviewer повинен мати можливість знайти в коді те, що кандидат заявляє.

## Що тепер можна чесно сказати про high load

> Runtime path оптимізований під read-heavy workload через Redis cache-aside, project/environment scoped cache keys, stateless API design і per-service-key rate limiting. Consumer SDK кешує snapshot локально та може відновити його з disk після restart. У repository є repeatable load-test script, а конкретні RPS/latency цифри називаються тільки після фактичного benchmark.

## Фінальна межа проєкту

Після проходження фінального manual checklist нові product features заморожуються.

Наступні етапи:

1. зафіксувати benchmark results;
2. привести main branch до фінального стану;
3. скласти resume;
4. project interview practice;
5. live coding;
6. AWS + Terraform окремо ближче до реального cloud/resume stage.
