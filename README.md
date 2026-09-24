# OpsPilot Admin

OpsPilot Admin is a portfolio B2B control plane for managing runtime configuration across multiple products and environments without changing the consumer application's source code for every operational adjustment.

The project is intentionally built as a production-oriented full-stack system rather than a static CRUD demo.

## Business problem

A company can have several products such as Dispatch, Customer Portal, Billing and Support. Each product may need operational parameters such as task limits, feature availability, retry policies and maintenance mode.

Building a separate admin panel, RBAC model, approval workflow, audit history and rollback system inside every product duplicates security and business logic.

OpsPilot centralizes that governance:

```text
Workspace (company)
├── Project: Flowline Dispatch
└── Project: Flowline Customer Portal
        │
        ↓
Draft → Submit → Approve → Publish
        │
        ↓
published runtime configuration
        │
        ↓
consumer backend / @opspilot/node SDK
```

## Implemented features

### Identity and access

- registration, login and logout;
- JWT authentication stored in an httpOnly cookie;
- workspace-scoped RBAC;
- roles: `owner`, `admin`, `editor`, `approver`, `viewer`;
- user management restricted to owner/admin;
- workspace-scoped member listing for tenant isolation.

### Configuration workflow

- multiple Projects inside one Workspace;
- development, staging and production environments;
- typed configuration values: number, boolean, string and JSON;
- project-specific supported-parameter catalog, so operators cannot publish keys the consumer application does not declare;
- Draft → Pending Approval → Approved → Published workflow;
- Reject with an optional reason;
- immutable revision history;
- diff between versions;
- rollback implemented as "restore as new draft";
- append-only audit events;
- Prisma transactions around workflow state changes.

### Runtime configuration

- PostgreSQL is the source of truth;
- Redis cache-aside runtime reads;
- TTL-based runtime cache;
- publish-time cache invalidation;
- PostgreSQL fallback when Redis is degraded;
- runtime cache keys are scoped by Project + Environment.

### Demo products

**Flowline Dispatch**

- persistent tasks stored in PostgreSQL;
- task creation and completion;
- persistent backend activity history;
- maintenance mode enforced on the backend;
- task capacity enforced by `limits.maxTasksPerUser`;
- digest availability controlled by `notifications.weeklyDigest`;
- carrier retry behavior controlled by `limits.maxRetries`.

**Flowline Customer Portal**

- self-service returns feature flag;
- support-ticket limit policy;
- maintenance mode;
- separate runtime configuration from Dispatch.

The active Project in OpsPilot opens the matching demo product.

### External consumer integration

- machine-to-machine service API keys;
- keys are bound to one Project + Environment;
- `runtime:read` least-privilege scope;
- raw service secret is shown only once;
- only a SHA-256 lookup hash is stored in PostgreSQL;
- key prefix, `lastUsedAt` and revocation state are stored;
- consumer endpoint: `GET /api/runtime/v1/config`;
- authenticated consumer cannot choose another Project/Environment through query parameters;
- short-lived Redis cache for service-key authentication, so the hot runtime path does not query PostgreSQL on every request;
- per-service-key runtime rate limiting backed by Redis.

### Node.js SDK

A small publishable-style package is included in `sdk/node`.

It supports:

- authenticated runtime fetch;
- in-memory cache;
- polling;
- request timeout;
- stale-on-error fallback;
- optional persistent local snapshot;
- recovery from an OpsPilot outage even after the consumer process restarts;
- maximum stale age through `maxStaleMs`.

The SDK is part of this repository and is not currently published to npm.

### Operations and observability

- Dockerfiles for Next.js and NestJS;
- development and production-like Docker Compose;
- PostgreSQL and Redis health checks;
- API liveness: `GET /api/health/live`;
- API readiness: `GET /api/health/ready`;
- request IDs returned as `x-request-id`;
- structured HTTP access logs with method, path, status and duration;
- configurable CORS and secure-cookie behavior;
- runtime API rate limiting;
- local runtime endpoint load-test script.

### Delivery

GitHub Actions CI runs:

```text
npm ci
↓
unit tests
↓
SDK tests
↓
Next.js production build
↓
NestJS production build
↓
Docker API image build
↓
Docker web image build
```

Dependabot and a Pull Request template are also included.

## Technology

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript | Admin UI and demo products |
| Backend | Node.js, NestJS, TypeScript | REST API, auth, RBAC and domain rules |
| Database | PostgreSQL, Prisma | Persistent domain data, revisions and audit |
| Cache | Redis | Runtime cache and rate-limit counters |
| Auth | JWT cookie + service API keys | User and machine authentication |
| SDK | TypeScript / Node.js | External runtime consumer integration |
| Runtime | Docker / Docker Compose | Reproducible local and production-like runtime |
| CI | GitHub Actions | Tests, builds and Docker quality gates |

## Architecture

```text
                     ┌───────────────────────┐
                     │     OpsPilot UI       │
                     │   Next.js / React     │
                     └──────────┬────────────┘
                                │ /api
                                ▼
                     ┌───────────────────────┐
                     │      NestJS API       │
                     │ JWT / RBAC / Guards   │
                     │ Services / Validation │
                     └───────┬───────┬───────┘
                             │       │
                         Prisma      │ runtime cache
                             │       ▼
                             │   ┌─────────┐
                             │   │  Redis  │
                             │   └─────────┘
                             ▼
                      ┌────────────┐
                      │ PostgreSQL │
                      └────────────┘

External customer backend
        │
        │ Bearer opk_...
        ▼
GET /api/runtime/v1/config
        │
        ▼
@opspilot/node
        │
        ├── memory snapshot
        └── optional disk snapshot
```

More detail: `docs/architecture.md`.

## Local development

Requirements:

- Node.js 24+
- npm 11+
- Docker Desktop

Start infrastructure:

```powershell
docker compose up -d
```

For an existing database, apply committed migrations and regenerate Prisma:

```powershell
npm run db:deploy
npm run db:generate
npm run db:seed
```

Start the application:

```powershell
npm run dev
```

Web: `http://localhost:3000`  
API: `http://localhost:4000/api`  
Dispatch demo: `http://localhost:3000/demo`  
Customer Portal demo: `http://localhost:3000/demo/portal`

## Public demo from a local machine

The repository contains a same-origin Next.js API proxy for the public demo:

```powershell
.\scripts\start-public-demo.ps1
ngrok http 3000
```

ngrok only exposes the locally running application. It is not a cloud deployment.

## Verification

Run all tests and production builds:

```powershell
npm run verify
```

Run the Node SDK tests:

```powershell
npm run sdk:test
```

Run the authenticated runtime load test after setting a service key:

```powershell
$env:OPSPILOT_API_KEY = "opk_..."
$env:OPSPILOT_URL = "http://localhost:3000"
npm run loadtest:runtime
```

The production runtime endpoint has a configurable per-key rate limit. For a dedicated local performance experiment, intentionally raise `RUNTIME_RATE_LIMIT_PER_MINUTE`, restart the API and record the environment/settings together with the measured results.

## What is deliberately not claimed

The current repository does **not** claim a completed AWS deployment, Terraform infrastructure or an SNS/SQS implementation.

Those are intentionally deferred to a later cloud/resume stage so the portfolio description remains verifiable from the code.

The project also has not been tested under real production traffic. Load-test numbers should be reported only after running the included benchmark in a documented local environment.

## Learning notes

The `docs/lessons` folder contains Ukrainian walkthroughs for the major stages, including authentication, RBAC, workflow, Redis, Docker, CI, persistent demo behavior and service-to-service integration.
