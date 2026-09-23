# OpsPilot architecture

## Product boundary

OpsPilot is the **control plane**. It owns governance around operational configuration:

- authentication and RBAC;
- Projects and Environments;
- Draft / Approval / Publish;
- revision history and rollback;
- audit trail;
- service credentials.

A customer's application is the **consumer**. It owns its own business logic and persistent business data.

OpsPilot does not rewrite the customer's source code. The customer integrates once with the runtime API/SDK and then reads published values dynamically.

## Main request paths

### Human admin request

```text
Browser
→ Next.js UI
→ /api same-origin proxy
→ NestJS
→ JwtAuthGuard
→ WorkspaceRoleGuard
→ Controller
→ Service
→ Prisma
→ PostgreSQL
```

The Guard answers authorization questions such as "may an editor submit this change?". The Service applies business rules such as "is this proposed value valid?".

### Publish

```text
Approved revision
→ owner/admin Publish
→ Prisma transaction
   ├── revision becomes PUBLISHED
   ├── ConfigEntry receives the published value
   └── AuditLog receives CONFIG_PUBLISHED
→ Redis runtime cache invalidation
```

Only **published** values are exposed to runtime consumers.

### External runtime consumer

```text
Customer backend
→ @opspilot/node
→ Authorization: Bearer opk_...
→ GET /api/runtime/v1/config
→ ServiceApiKeyGuard
→ SHA-256(candidate secret)
→ Redis auth-context cache
   ├── HIT → authenticated context
   └── MISS → PostgreSQL key lookup + lastUsedAt → Redis SET
→ RuntimeRateLimitGuard
→ ConfigsService
→ Redis cache
   ├── HIT → return snapshot
   └── MISS → PostgreSQL → Redis SET → return snapshot
→ SDK memory snapshot
→ optional disk snapshot
→ customer business code
```

The service key is bound to one Project + Environment. The consumer does not choose that scope in query parameters.

## Availability decisions

PostgreSQL is required for the control plane.

Redis is an optimization and protection layer:

- runtime configuration cache;
- short-lived service-key authentication context cache;
- fixed-window runtime rate-limit counters.

If Redis is unavailable:

- runtime config falls back to PostgreSQL;
- rate limiting fails open for availability;
- readiness reports Redis as degraded rather than making the whole service unavailable.

The Node SDK adds a second resilience boundary on the customer side:

- `network`: fresh snapshot from OpsPilot;
- `memory`: fresh local process snapshot;
- `disk`: snapshot recovered after process restart;
- `stale`: OpsPilot refresh failed, but the last snapshot is still inside `maxStaleMs`.

This prevents a short OpsPilot outage from automatically becoming a customer outage.

## Data ownership

### PostgreSQL

Persistent source of truth for:

- users;
- workspaces and memberships;
- projects;
- configuration entries;
- revisions;
- audit logs;
- Dispatch demo tasks/events;
- service API key hashes and metadata.

### Redis

Temporary data only:

- runtime configuration snapshots with TTL;
- per-key rate-limit counters.

Redis data can be recreated from PostgreSQL/runtime traffic.

### Customer-side SDK snapshot

Optional local persistence owned by the consumer. It contains only the runtime configuration the service key is allowed to read.

## Security boundaries

- JWT cookie authenticates a human user.
- RBAC authorizes human actions.
- Service API key authenticates a machine.
- Service-key `runtime:read` scope applies least privilege.
- Raw service keys are not stored in PostgreSQL.
- Service keys are bound server-side to Project + Environment.
- User/member lists are scoped to the active Workspace.
- Backend validation is authoritative; frontend validation exists for UX only.
- Secrets must stay in server-side environment variables and never in `NEXT_PUBLIC_*`.

## Observability

Every API request receives an `x-request-id`.

NestJS writes structured access logs containing:

- request ID;
- method;
- path;
- HTTP status;
- duration in milliseconds.

Health endpoints:

- `/api/health/live`: process liveness;
- `/api/health/ready`: required PostgreSQL readiness + Redis degradation status.

## Scaling path

The current code is designed so the NestJS API can remain stateless with respect to user sessions and runtime reads.

A future cloud deployment can horizontally scale API instances behind a load balancer while sharing PostgreSQL and Redis.

Before claiming production-scale performance, use the included load-test script and report the exact machine, concurrency, request count, rate-limit setting and measured p50/p95/p99 latency.

## Deferred intentionally

Not implemented yet:

- AWS deployment;
- Terraform;
- managed PostgreSQL/Redis;
- message queue/background worker;
- centralized production log platform;
- published npm package for `@opspilot/node`.

These are future infrastructure stages, not current project claims.
