# Урок 1. Як працює перший vertical slice

## Мета уроку

Побачити повний шлях одного запиту:

```text
Next.js browser UI → HTTP request → Nest.js controller → service → response → UI state
```

Це базова модель майже будь-якого web-продукту. Якщо зрозуміти цей шлях, далі буде легше розібратися з базою даних, auth, events і AWS.

## Що таке monorepo

Monorepo — один Git-репозиторій для кількох пов'язаних застосунків і shared packages.

У нашому випадку:

- `apps/web` — браузерний Next.js адмін-застосунок;
- `services/config-api` — Nest.js backend для параметрів Flowline;
- `packages/contracts` — спільні TypeScript-типи;
- `infra` — майбутня Terraform-інфраструктура.

Вони мають окремі відповідальності, але розвиваються як один продукт. npm workspaces дозволяє встановити залежності з одного root і підключати внутрішній пакет через `@opspilot/contracts`.

## Що робить `npm install`

`package.json` описує бажані залежності, наприклад Next.js або Nest.js. `npm install`:

1. читає root і workspace `package.json`;
2. обчислює сумісне дерево пакетів;
3. завантажує пакети в `node_modules`;
4. створює `package-lock.json` із точними версіями.

Lock-файл потрібен, щоб у тебе, у CI та в AWS встановлювався однаковий dependency tree. `node_modules` у Git не комітимо, бо це локальний похідний результат.

## Що робить Docker Compose

Наш код — це застосунки. PostgreSQL і Redis — зовнішні інфраструктурні залежності. Docker Compose запускає їх однаково на будь-якому комп'ютері з Docker:

```powershell
docker compose up -d
docker compose ps
```

`-d` означає detached mode: контейнери працюють у фоні. PostgreSQL слухає порт `5432`, Redis — `6379`. На цьому етапі API ще не використовує їх: ми спочатку перевіряємо HTTP-шлях, а persistence підключимо наступним етапом.

## Що таке Nest.js controller і service

- Controller знає про HTTP: URL, method, query, body і status code.
- Service знає про домен: як знайти, створити, перевірити або змінити конфігурацію.

Таке розділення важливе. Якщо бізнес-правило лежить у React-компоненті або прямо в controller, його важко повторно використати в SDK, worker або іншому API.

## Що таке Next.js client component

`ConfigConsole` має директиву `"use client"`, бо йому потрібні `useState`, `useEffect`, форма та події click/submit. Він викликає backend через `fetch` і зберігає відповідь у state.

Пізніше ми розділимо сторінку на server components і client components там, де це дає перевагу. Зараз client component прозорий для навчання: видно повний цикл request → loading → success/error.

## Що перевіряємо вручну

```powershell
npm install
docker compose up -d
npm run dev
```

Після запуску:

- web UI: `http://localhost:3000`;
- API health: `http://localhost:4000/api/health`;
- configs: `http://localhost:4000/api/configs?environment=staging`.

У другому PowerShell можна перевірити API без браузера:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod "http://localhost:4000/api/configs?environment=staging"
```

## Що вже є бізнес-правилом

API не дозволяє:

- створити дубльований key у тому самому environment;
- зберегти число як boolean;
- зберегти нечислове значення як number;
- оновити config, якого не існує.

Ці правила знаходяться в `ConfigsService`, а не в UI. UI допомагає користувачу, але backend залишається джерелом істини.

## Чому спочатку in-memory

In-memory storage тимчасово прибирає одну змінну — міграції та SQL — і дозволяє перевірити межі API та UI. Це не фінальне рішення: після підтвердження першого зрізу замінимо масив на PostgreSQL/Prisma, не змінюючи контракт frontend.

Це типовий спосіб роботи: спочатку перевірити доменний контракт маленьким вертикальним зрізом, потім замінити адаптер зберігання.

## Middle-level checklist

Після цього етапу ти маєш уміти пояснити:

1. чим frontend відрізняється від backend;
2. що таке HTTP GET/POST/PATCH;
3. навіщо потрібні controller, service і DTO;
4. чому типи TypeScript не замінюють runtime validation;
5. навіщо потрібен lock-файл;
6. чому база даних і Redis запускаються окремими сервісами;
7. де саме знаходиться бізнес-правило «тип значення має відповідати schema».
