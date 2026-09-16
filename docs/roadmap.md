# Roadmap

## Phase 0 — foundation

- npm workspaces monorepo;
- Next.js admin app, Nest.js config API and shared contracts;
- PostgreSQL/Redis Docker Compose services;
- health endpoint and first dashboard;
- lesson about HTTP, controllers, services, DTOs and environment variables.

## Phase 1 — persistent configuration registry

- PostgreSQL schema with Prisma;
- Flowline service and environments;
- typed parameters and validation rules;
- CRUD API and admin forms;
- migrations, seed data and integration tests.

## Phase 2 — safe change workflow

- [x] draft/version model;
- [x] validation result and meaningful diff;
- [x] submit/approve/reject/publish states;
- [x] immutable audit trail at the API boundary;
- [x] rollback to a previous version.

## Phase 3 — account and access

- registration and login;
- password hashing and sessions/JWT;
- workspace membership and workspace-scoped configuration data;
- Owner/Admin/Editor/Approver/Viewer roles with API role guard;
- personal profile and account settings;
- route guards and API authorization tests;
- workspace members screen and invitations.

## Phase 4 — runtime service behavior

- public runtime-config endpoint;
- [x] Redis cache and cache invalidation on publish;
- [x] feature flags, maintenance mode and content settings;
- [x] demo customer-facing web page that visibly reacts to published values;
- rate limiting and safe fallback behavior.

## Phase 5 — service decomposition

- identity service;
- configuration service;
- notification/audit worker;
- event contracts and SNS/SQS-compatible adapter;
- idempotency and dead-letter handling.

## Phase 6 — production engineering

- OpenTelemetry traces;
- structured logs and correlation IDs;
- contract, integration and e2e tests;
- [x] Docker images and health checks;
- [x] GitHub Actions quality gates.

## Phase 7 — AWS release

- Terraform modules for network, IAM, ECR, ECS, RDS, S3, queues and observability;
- staging deployment;
- smoke tests;
- production deployment with manual approval;
- runbook, rollback procedure and cost guardrails.

## Phase 8 — portfolio package

- public README and architecture decisions;
- screenshots and short demo video;
- resume bullets with measurable technical outcomes;
- interview walkthrough covering product, trade-offs, security and scaling.


## Completed: runtime consumer and workspace user management

- Demo React client consumes the public runtime configuration.
- Feature flags and limits visibly change client behaviour after publish.
- Owners/admins can list registered accounts and manage workspace roles.
- New registrations use least-privilege viewer access after the first owner.
