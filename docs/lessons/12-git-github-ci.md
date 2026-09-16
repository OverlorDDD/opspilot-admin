# Урок 12 — Git, GitHub і CI через GitHub Actions

## 1. Навіщо Git

Git зберігає історію змін коду.

Типовий цикл:

```text
змінив файли
  ↓
git diff
  ↓
git add
  ↓
git commit
```

**Commit** — контрольна точка стану проєкту. Він повинен описувати одну зрозумілу зміну.

Приклади повідомлень:

```text
feat: add runtime config consumer
fix: invalidate Redis cache after publish
ci: add GitHub Actions pipeline
```

## 2. GitHub

GitHub зберігає Git-репозиторій у хмарі. Це дає:

- backup коду;
- історію commit-ів;
- branches;
- pull requests;
- code review;
- GitHub Actions;
- майбутній зв'язок із AWS deployment.

## 3. Branch

**Branch** — окрема гілка роботи.

Наприклад:

```text
main
  └─ feature/user-invitations
```

Ми не зобов'язані робити кожну маленьку вправу через branch, але в командній розробці feature branch + Pull Request — стандартний безпечний workflow.

## 4. Pull Request

**Pull Request (PR)** — пропозиція злити зміни з однієї branch в іншу.

PR дає місце для:

- опису зміни;
- автоматичних CI checks;
- review;
- обговорення;
- безпечного merge у `main`.

У проєкті тепер є `.github/pull_request_template.md`, щоб PR не був порожнім.

## 5. CI

**CI (Continuous Integration)** — автоматична перевірка коду після push/PR.

Наш pipeline:

```text
Push / Pull Request
        ↓
GitHub Actions runner
        ↓
npm ci
        ↓
npm test
        ↓
npm run build
        ↓
Docker build API
        ↓
Docker build Web
        ↓
green check або failure
```

Це означає: перед merge GitHub сам перевіряє, що код тестується, компілюється і контейнеризується.

## 6. `npm install` vs `npm ci`

`npm install` зручно використовувати під час звичайної розробки. Він може оновлювати `package-lock.json`.

`npm ci` призначений для CI/production build:

- вимагає `package-lock.json`;
- ставить точні зафіксовані версії;
- не переписує lock-file;
- робить build відтворюванішим.

Тому `package-lock.json` потрібно комітити в Git.

## 7. Що перевіряє наш workflow

Файл:

```text
.github/workflows/ci.yml
```

Має два jobs.

### `test-and-build`

```text
checkout
→ setup Node 24
→ npm ci
→ npm test
→ npm run build
```

### `docker-build`

Після успішного першого job:

```text
build NestJS Docker image
build Next.js Docker image
```

Поки що image не публікується. Наступний AWS-етап додасть push у Amazon ECR.

## 8. Dependabot

Файл:

```text
.github/dependabot.yml
```

Просить GitHub раз на тиждень перевіряти оновлення:

- npm dependencies;
- GitHub Actions.

Dependabot не означає "автоматично приймати все". Він створює PR, а ми дивимося CI і перевіряємо change.

## 9. Чому CI важливий для middle developer

Локальне "у мене працює" недостатньо. CI дає повторювану перевірку в чистому середовищі.

Корисна фраза для співбесіди:

> Для pull requests я налаштував GitHub Actions CI: exact dependency install через npm ci, unit tests, production build і Docker image build. Це ловить regression до merge у main.

## 10. Що буде далі

Після CI наступний deployment flow стане таким:

```text
GitHub main
  ↓
CI tests/build
  ↓
Docker images
  ↓
Amazon ECR
  ↓
Amazon ECS Fargate
  ↓
public URL
```

Infrastructure (`VPC`, `ECS`, `RDS`, `Redis`, `ALB`, IAM) буде описана Terraform-кодом.

## 11. Чому тести в monorepo спочатку збирають shared package

OpsPilot — **monorepo**: в одному Git-репозиторії лежать кілька частин системи.

```text
apps/web                 → Next.js
services/config-api      → NestJS
packages/contracts       → спільні TypeScript-типи
```

API імпортує типи через пакет:

```ts
import { EnvironmentName } from "@opspilot/contracts";
```

Тому перед Jest ми збираємо `@opspilot/contracts` у `packages/contracts/dist`.
Після цього тести використовують пакет так само, як реальний застосунок, а `ts-jest` трансформує лише TypeScript самого NestJS-сервісу.

У кореневому `package.json` для цього є:

```text
pretest → build @opspilot/contracts
 test   → Jest у workspaces
```

Це також пояснює різницю між **source code** (`src`) і **build output** (`dist`).

## 12. npm audit: чому не треба сліпо запускати `--force`

`npm audit` перевіряє дерево залежностей на відомі security vulnerabilities.

Спочатку безпечно подивитися звіт:

```powershell
npm audit
```

`npm audit fix` намагається поставити сумісні виправлення. А `npm audit fix --force` може перейти на major-версії пакетів із breaking changes. Для навчального та production-проєкту такі оновлення треба робити свідомо й після них повторювати tests/build.

## 13. install scripts і `allowScripts`

Деякі npm-пакети повинні виконати маленький скрипт під час встановлення. Наприклад Prisma готує свої engines, а `esbuild` — платформний binary.

Сучасний npm дозволяє явно записати, яким пакетам ми довіряємо виконувати такі install scripts. В OpsPilot у `package.json` дозволені конкретні перевірені версії Prisma та esbuild через `allowScripts`.

Ідея безпеки проста:

```text
dependency хоче запустити install script
            ↓
перевіряємо пакет і версію
            ↓
явно approve
```

Не треба використовувати глобальний режим «дозволити всі scripts», якщо можна дозволити лише потрібні залежності.
