# Урок 0. Як влаштований web-сайт

Цей урок — стартова точка. Не потрібно знати попередні документи або вміти програмувати web.

## 1. Сайт — це не один файл

Коли ти відкриваєш адресу сайту, зазвичай взаємодіють кілька програм:

```text
Браузер користувача
        ↓ HTTP-запит
Frontend-застосунок
        ↓ HTTP-запит до API
Backend-застосунок
        ↓
База даних
```

### Браузер

Chrome запускає HTML, CSS і JavaScript та показує результат на екрані. Кнопки, форми, таблиці й повідомлення про помилки — це робота frontend.

### Frontend

Frontend — частина програми, яку бачить користувач. У нашому проєкті це React-компоненти, запущені через Next.js.

Frontend відповідає за:

- розмітку сторінки;
- стилі;
- поля форм;
- loading/error/empty/success states;
- відправку запитів до backend;
- показ отриманих даних.

### Backend

Backend — програма на сервері. Користувач її напряму не бачить. Вона приймає запити, перевіряє права, застосовує бізнес-правила і працює з базою даних.

У нашому проєкті backend буде написаний на Nest.js, який працює поверх Node.js.

### База даних

База даних зберігає інформацію після перезапуску програми: користувачів, workspace, налаштування, версії й audit log. У нас буде PostgreSQL.

### Redis

Redis — швидке тимчасове сховище в пам'яті. Його використовують для кешу, rate limit, короткоживучих сесій і черг. Він не замінює PostgreSQL.

## 2. Node.js, React, Next.js і Nest.js — це різні речі

| Назва | Просте пояснення |
|---|---|
| Node.js | середовище, у якому JavaScript може працювати поза браузером |
| React | бібліотека для створення UI-компонентів |
| Next.js | framework навколо React: routing, build, server/client components, deployment conventions |
| Nest.js | framework для Node.js backend: modules, controllers, services, guards і dependency injection |
| TypeScript | JavaScript із типами, які допомагають ловити помилки під час розробки |

Аналогія: Node.js — двигун, React — набір деталей для інтерфейсу, Next.js — організація frontend-застосунку, Nest.js — організація backend-застосунку.

## 3. Що таке API

API — це домовленість, за якою одна програма просить дані в іншої.

Наш перший запит:

```http
GET http://localhost:4000/api/configs?environment=staging
```

Розшифровка:

- `GET` — «дай мені дані»;
- `localhost` — цей самий комп'ютер;
- `4000` — порт, на якому слухає Nest.js;
- `/api/configs` — адреса ресурсу конфігурацій;
- `environment=staging` — query parameter.

Backend повертає JSON:

```json
{
  "project": { "id": "flowline-service", "name": "Flowline Service" },
  "items": [
    {
      "name": "limits.maxTasksPerUser",
      "type": "number",
      "value": 25
    }
  ],
  "total": 1
}
```

JSON — текстовий формат даних. Frontend перетворює цей JSON на картки й рядки таблиці.

## 4. Як це розкладено в нашому коді

| Файл | Роль |
|---|---|
| `apps/web/app/page.tsx` | сторінка Next.js |
| `apps/web/app/config-console.tsx` | React UI, state і fetch-запити |
| `services/config-api/src/main.ts` | запуск Nest.js, CORS, validation, port |
| `services/config-api/src/health.controller.ts` | endpoint перевірки доступності API |
| `services/config-api/src/configs/configs.controller.ts` | HTTP routes конфігурацій |
| `services/config-api/src/configs/configs.service.ts` | бізнес-правила конфігурацій |
| `packages/contracts/src/index.ts` | спільні типи між frontend і backend |

## 5. Чому controller і service розділені

Controller відповідає на питання «як прийшов запит?» — GET, POST, URL, body.

Service відповідає на питання «чи дозволена ця операція?» — чи правильний тип, чи немає дубля, чи існує запис.

Наприклад, користувач може відправити число як текст. TypeScript допомагає розробнику, але дані з мережі приходять під контролем користувача. Тому backend додатково перевіряє значення під час виконання — це runtime validation.

Backend є джерелом істини. Навіть якщо frontend перевіряє форму, backend зобов'язаний перевірити її ще раз.

## 6. Що робить перший vertical slice

Vertical slice — маленька функція, яка проходить через усі потрібні шари.

Наш перший slice:

1. Nest.js повертає список параметрів Flowline.
2. Next.js завантажує список через `fetch`.
3. React показує його на dashboard.
4. Користувач вибирає параметр.
5. Форма відправляє PATCH-запит.
6. Backend перевіряє тип і оновлює значення.
7. Frontend завантажує актуальний список.

Ми свідомо починаємо з in-memory масиву. Це тимчасове сховище для перевірки повного шляху. Наступним етапом замінимо його на PostgreSQL/Prisma, не змінюючи основний API-контракт.

## 7. Команди першого запуску

У PowerShell з кореня проєкту:

```powershell
npm install
docker compose up -d
npm run dev
```

Адреси:

- `http://localhost:3000` — frontend;
- `http://localhost:4000/api/health` — backend health check;
- `http://localhost:4000/api/configs?environment=staging` — API даних.

## Перевірка розуміння

Перед наступним етапом важливо вміти своїми словами відповісти:

1. Що бачить користувач: frontend чи backend?
2. Яка програма слухає порт `4000`?
3. Чому браузер не повинен сам вирішувати, чи дозволено змінити параметр?
4. Де зберігатимуться дані після підключення PostgreSQL?
5. Яка різниця між Node.js і Nest.js?
