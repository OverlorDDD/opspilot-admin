# OpsPilot Admin

OpsPilot Admin — production-oriented web admin panel for a fictional B2B SaaS company, Flowline. The panel lets an operations team change service parameters safely without editing code or deploying a new backend version.

## Business problem

Flowline has operational settings such as task limits, feature availability, maintenance mode and notification behavior. Developers should not need to change a source file or run SQL for every business adjustment. At the same time, unrestricted edits are dangerous.

OpsPilot provides a controlled workflow: authenticated workspace → parameter edit → validation → draft → approval → publish → audit → rollback.

This is a web-only product. It does not depend on Unity, game development or C#.

## First release

- registration and login;
- personal profile and account settings;
- workspace and role-based access;
- operational parameter registry;
- typed values: number, boolean, string and JSON;
- draft/publish workflow;
- validation, diff and rollback;
- feature flags and maintenance mode;
- notification/content settings;
- audit log;
- public runtime-config endpoint consumed by a demo web service;
- tests, Docker Compose, CI/CD and AWS deployment through Terraform.

## Technology

| Layer | Technology | Responsibility |
|---|---|---|
| Admin UI | Next.js, React, TypeScript | dashboard, forms, settings and access states |
| API | Nest.js, TypeScript | auth, RBAC and domain API |
| Data | PostgreSQL, Prisma | users, workspaces, versions and audit |
| Cache | Redis | fast reads and short-lived session/rate-limit data |
| Events | SNS/SQS-compatible flow | asynchronous audit/telemetry work |
| Runtime | Docker | reproducible local and cloud processes |
| Cloud | AWS ECS/Fargate, RDS, S3, CloudWatch | public deployment |
| IaC | Terraform | versioned infrastructure |
| Delivery | GitHub Actions | quality gates and deployment |

## Development approach

We build small vertical slices. Each slice includes domain rules, backend endpoint, UI state, tests and an explanation in `docs/lessons`. This keeps the product understandable while building the engineering habits expected from a middle developer.

## Current status

The monorepo, Nest.js API, Next.js dashboard, shared contracts, Docker Compose and tests are created. Configuration entries are persisted in PostgreSQL through Prisma, admin routes are protected by cookie-based JWT authentication and workspace roles, and configuration changes use versioned drafts, approval states, transactional publish, revision diff, safe rollback-as-draft and an audit log. The public runtime endpoint uses Redis cache-aside reads with TTL, PostgreSQL fallback and publish-time cache invalidation. Flowline Dispatch demonstrates real runtime behavior changes. GitHub Actions CI now runs tests, production builds and Docker image builds on push and pull requests.

## Local commands

```powershell
npm install
docker compose up -d
npm run db:migrate:init       # fresh database only
npm run db:migrate:auth       # after the initial migration
npm run db:migrate:workspace  # after the auth migration
npm run db:migrate:workflow   # adds revisions and audit log
npm run db:generate
npm run db:seed
npm run dev
```

Run the migration commands that apply to your database state. If you already completed the workspace/RBAC stage, run `npm run db:migrate:workflow`, then `npm run db:generate` and `npm run db:seed`.

Before the database commands, create `services/config-api/.env` from `services/config-api/.env.example`. If that file already exists from the PostgreSQL stage, add the `JWT_SECRET` line from the example manually.

For a fresh checkout, run `npm run db:migrate:init` before `npm run db:seed`. For an existing checkout that already has the initial migration, run `npm run db:migrate:auth` instead.

For the authentication migration after the initial migration, run `npm run db:migrate:auth` and then start the app. The first screen now contains registration and login.

For the workspace and role migration after the authentication migration, run `npm run db:migrate:workspace`, then `npm run db:generate` and `npm run db:seed`. Restart the development process after the Prisma schema changes. Existing users can be linked to `Flowline Operations`; in the demo registration flow the first member becomes `owner`, while later registrations join as `viewer`.

Web UI: `http://localhost:3000`  
API health: `http://localhost:4000/api/health`  
Runtime snapshot: `http://localhost:4000/api/configs/runtime?environment=staging`


Workflow lesson: `docs/lessons/06-config-workflow-and-audit.md`  
Diff/rollback lesson: `docs/lessons/07-diff-and-safe-rollback.md`  
Redis cache lesson: `docs/lessons/08-redis-cache-and-invalidation.md`

## Phase 5: Demo client and user management

- `http://localhost:3000/` — authenticated OpsPilot admin console.
- `http://localhost:3000/demo` — public demo consumer of the staging runtime configuration.
- Owners/admins can open **Users** in the admin top bar to view registered accounts and manage workspace roles.
- The first member of a fresh `Flowline Operations` workspace becomes `owner`; later demo registrations join as `viewer` (least-privilege default).
- No Prisma migration is required for this phase because `User`, `WorkspaceMember`, and role fields already exist.

Beginner walkthrough: `docs/lessons/09-demo-client-and-user-management.md`.

## Phase 6: Production containers and health checks

This phase prepares the same codebase for cloud deployment instead of relying on development processes.

- Boolean configuration values now use an accessible on/off switch instead of manually typing `true` or `false`.
- `apps/web/Dockerfile` builds the Next.js app with standalone output.
- `services/config-api/Dockerfile` builds the NestJS API and exposes a separate one-shot Prisma migrator target.
- `docker-compose.production.yml` runs PostgreSQL, Redis, migrations, demo seed, API and web with startup health conditions.
- Production-like Docker uses separate named database/Redis volumes, so testing it does not overwrite the normal development data.
- `GET /api/health/live` checks process liveness.
- `GET /api/health/ready` verifies PostgreSQL readiness and reports Redis as ready/degraded.
- `CORS_ORIGINS` and `COOKIE_SECURE` are now environment-driven so localhost and future HTTPS/AWS deployments can use different values without changing application code.
- `.env.production.example` documents the production-like variables; real `.env.production.local` secrets should never be committed.

Production-like local start:

```powershell
Copy-Item .env.production.example .env.production.local
# Edit the copied file and replace placeholder secrets.

docker compose down
docker compose --env-file .env.production.local -f docker-compose.production.yml up --build -d
docker compose --env-file .env.production.local -f docker-compose.production.yml ps
```

Do not use `docker compose down -v` unless you intentionally want to delete local database/Redis volumes.

Beginner walkthrough: `docs/lessons/10-production-docker-and-health.md`.

## Phase 7: Git, GitHub and CI

- `.github/workflows/ci.yml` runs on push/PR to `main`.
- CI installs exact dependencies with `npm ci`, runs tests/build, then builds both Docker images without publishing them.
- `.github/dependabot.yml` checks npm and GitHub Actions updates weekly.
- `.github/pull_request_template.md` adds a consistent review/testing checklist.
- `package-lock.json` must be committed because CI and Docker builds now depend on it for reproducible installs.

Beginner walkthrough: `docs/lessons/12-git-github-ci.md`.

## CI test note

Before Jest runs, the root `pretest` script builds `@opspilot/contracts`. This keeps Jest focused on the NestJS source while tests consume the shared contracts package through its compiled `dist` output. npm install-script approvals for the pinned Prisma/esbuild versions are declared in the root `allowScripts` policy.


## Phase 8: Persistent Dispatch and central control plane

OpsPilot now demonstrates a stronger B2B use case: one company workspace can centrally manage runtime policy for multiple products instead of rebuilding the same admin/RBAC/audit workflow inside every application.

- Workspace = company/organization.
- Project = one product or service inside that company.
- The admin UI now has a Project selector.
- Seed data includes **Flowline Dispatch** and **Flowline Customer Portal**.
- Redis runtime cache keys are scoped by project + environment.
- Flowline Dispatch tasks are stored in PostgreSQL and survive page reloads.
- Task completion, weekly digest actions and carrier sync results create persistent backend events.
- Runtime policy is enforced by the NestJS consumer backend:
  - `limits.maxTasksPerUser` limits task creation;
  - `service.maintenanceMode` rejects write actions;
  - `notifications.weeklyDigest` enables/disables digest queueing;
  - `limits.maxRetries` changes whether the simulated carrier integration succeeds.
- Draft edits are now saved as part of **Submit for approval**, so the extra Save draft button is no longer required.
- User management remains restricted to owner/admin and the returned member list is scoped to the current workspace.

Apply the committed database migration before running this phase:

```powershell
npm run db:deploy
npm run db:generate
npm run db:seed
```

Beginner walkthrough: `docs/lessons/14-persistent-dispatch-control-plane.md`.
