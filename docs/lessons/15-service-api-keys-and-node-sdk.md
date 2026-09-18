# Урок 15. Service API keys і @opspilot/node SDK

## Навіщо цей етап

До цього наші demo-продукти вже читали runtime config, але вони жили в одному monorepo. Тепер ми додаємо реалістичний спосіб підключення **стороннього backend-сервісу**.

Ідея така:

```text
OpsPilot Admin
→ owner/admin створює service key
→ key прив'язаний до Project + Environment
→ сторонній Node.js backend
→ Authorization: Bearer opk_...
→ GET /api/runtime/v1/config
→ published runtime config
```

## Чому service key не є JWT користувача

JWT cookie відповідає на питання:

> Яка людина зараз працює в OpsPilot Admin?

Service API key відповідає на інше питання:

> Який зовнішній сервіс зараз читає runtime config?

Тому ці два способи authentication не треба змішувати.

## Як зберігається ключ

При створенні backend генерує секрет:

```text
opk_xxxxxxxxxxxxxxxxxxxxxxxxx
```

Користувач бачить його лише один раз.

У PostgreSQL ми НЕ зберігаємо raw secret. Замість цього:

```text
raw key
→ SHA-256
→ key_hash
```

Також зберігається короткий `keyPrefix`, щоб у UI можна було зрозуміти, який credential це був.

Якщо базу прочитає стороння людина, готового ключа там немає.

## Scope

Поточний scope:

```text
runtime:read
```

Тобто цей credential не може:

- створювати draft;
- approve;
- publish;
- змінювати users;
- створювати інші keys.

Він тільки читає published runtime config.

## Project + Environment binding

Ключ створюється для конкретної пари:

```text
Flowline Dispatch + staging
```

Тому consumer не надсилає `projectId` або `environment` у runtime request.

Сервер сам знає scope credential-а.

Це зменшує шанс, що service випадково або навмисно прочитає config іншого продукту.

## Consumer endpoint

```http
GET /api/runtime/v1/config
Authorization: Bearer opk_...
```

Backend:

1. хешує отриманий secret;
2. знаходить hash у PostgreSQL;
3. перевіряє `revokedAt`;
4. перевіряє scope;
5. оновлює `lastUsedAt`;
6. дістає runtime config тільки для прив'язаного Project + Environment;
7. повертає published values.

## Revocation

Owner/admin може натиснути Revoke.

Після цього той самий secret залишається у зовнішнього сервісу, але OpsPilot більше його не приймає:

```text
Authorization: Bearer old-key
→ 401 Unauthorized
```

Це важливо при:

- витоку credential;
- видаленні інтеграції;
- rotation ключів.

## Що таке SDK

SDK — це маленька бібліотека, яка ховає повторювану integration logic.

Без SDK:

```ts
fetch(...)
Authorization header
timeout
JSON parsing
cache
retry/fallback logic
```

З SDK:

```ts
const client = new OpsPilotClient({
  baseUrl,
  apiKey,
});

await client.refresh();

const maxRetries = client.get("payment.maxRetries", 3);
```

## Чому consumer не ходить в OpsPilot на кожний request

Погано:

```text
customer request
→ customer backend
→ OpsPilot
→ database
→ response
```

Якщо OpsPilot повільний або недоступний, клієнтський сервіс теж починає ламатися.

Тому `@opspilot/node` кешує останній snapshot у пам'яті.

```text
OpsPilot
   ↓ refresh every 60s
Node consumer memory
   ↓
business requests
```

## memory / network / stale

SDK показує джерело snapshot:

- `network` — щойно отримали з OpsPilot;
- `memory` — snapshot ще свіжий, HTTP request не потрібен;
- `stale` — refresh не вдався, але є остання успішна копія.

`stale-on-error` потрібен, щоб тимчасове падіння configuration service не вимикало бізнес-сервіс клієнта.

## Security rule для React

Secret service key не можна класти в:

```text
NEXT_PUBLIC_...
React state
browser localStorage
frontend source code
```

Бо browser-код доступний користувачу.

Правильна схема:

```text
OpsPilot
→ customer's backend
→ customer's frontend
```

## Що тепер є у UI

Owner/admin бачить кнопку `Integrations`.

Там можна:

1. створити key;
2. побачити secret один раз;
3. скопіювати Node.js приклад;
4. побачити keyPrefix;
5. побачити `lastUsedAt`;
6. revoke key.

Viewer/editor/approver не повинні мати доступ до цього panel/API.

## Що розповідати на співбесіді

> For machine-to-machine access I separated user authentication from service authentication. Admin users use JWT cookies and RBAC, while external consumers receive a project-and-environment-scoped service key with only runtime:read permission. The raw key is shown once and only a SHA-256 hash is stored in PostgreSQL. The Node SDK keeps an in-memory snapshot and falls back to stale configuration if the control plane is temporarily unavailable.

## Manual test

1. Owner/admin відкриває Integrations.
2. Створює key для Dispatch staging.
3. Копіює secret.
4. Викликає runtime endpoint через Bearer key.
5. Перевіряє `lastUsedAt`.
6. Запускає SDK example.
7. Створює key для Customer Portal і перевіряє, що config інший.
8. Revoke key.
9. Старий key отримує 401.
10. Viewer/editor не бачить Integrations.
