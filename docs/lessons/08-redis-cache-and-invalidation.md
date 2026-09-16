# Урок 08 — Redis cache і cache invalidation

## Навіщо cache

Runtime endpoint часто повертає ті самі published values. Немає сенсу кожного разу робити однаковий запит у PostgreSQL.

Тому використовується Redis:

```text
Client → NestJS → Redis
                  ├─ HIT → response
                  └─ MISS → PostgreSQL → Redis SET → response
```

## Redis

**Redis** — дуже швидке in-memory key-value сховище. У нашому проєкті він використовується як тимчасовий cache, а не як головна база.

PostgreSQL залишається **source of truth**.

## Cache-aside

Патерн:

```text
1. шукаємо в cache
2. якщо є → повертаємо
3. якщо немає → читаємо БД
4. кладемо результат у cache
```

## HIT / MISS / BYPASS

- `HIT` — потрібне значення вже є в Redis;
- `MISS` — cache порожній, читаємо PostgreSQL і створюємо cache;
- `BYPASS` — Redis недоступний, тому читаємо PostgreSQL напряму.

## TTL

**TTL (Time To Live)** — скільки секунд ключ живе в cache.

Наприклад:

```text
TTL = 60 seconds
```

Після цього Redis автоматично видалить ключ.

## Cache invalidation

Після `Publish` cached runtime може стати застарілим. Тому ми видаляємо старий ключ:

```text
Publish DB transaction
  ↓ success
DELETE Redis key
  ↓
next request = MISS
  ↓
fresh PostgreSQL data
```

## Fallback

Якщо Redis впав, API не повинен падати разом із ним. Він переходить на PostgreSQL. Cache прискорює систему, але не є критичною залежністю.

## Що сказати на співбесіді

> Runtime config використовує cache-aside у Redis з TTL, invalidation після publish і graceful fallback на PostgreSQL.
