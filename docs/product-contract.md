# Product contract

## Product

`OpsPilot Admin` is an internal-style B2B admin console for `Flowline`, a fictional SaaS company. It manages the operational parameters that control how the customer-facing Flowline service behaves.

The product is intentionally web-only. There is no Unity, C# or game-specific responsibility.

## Real business problem

Operations, support and product teams need to change service behavior quickly. Requiring a developer and a deployment for every limit, feature toggle, maintenance switch or notification text creates delay and risk. Direct database editing is faster but unsafe and unaudited.

OpsPilot gives these teams a safe control surface with explicit permissions and a history of changes.

## User roles

- `Owner` — manages workspace, members and billing-free account settings;
- `Admin` — manages service settings and members;
- `Editor` — creates drafts and edits parameters;
- `Approver` — reviews, approves or rejects changes;
- `Viewer` — reads settings, history and service status.

## Main user journey

1. A user registers and creates a workspace.
2. The owner invites a teammate and assigns a role.
3. An editor opens the Flowline service settings.
4. The editor changes a typed parameter, for example `limits.maxTasksPerUser` from `25` to `40`.
5. The backend validates the value and records a draft version.
6. The editor sees the diff and submits it for approval.
7. An approver approves or rejects the proposed revision.
8. An owner or admin publishes an approved revision for `development`, `staging` or `production`.
9. The runtime-config endpoint returns the currently published values to the service.
10. The audit page shows who changed what, when and why.
11. An authorized user can roll back to a previous version.

## Parameter groups

| Group | Examples | Why it matters |
|---|---|---|
| Service | maintenance mode, support email, timezone | operational control |
| Limits | max tasks, attachment size, API rate limit | capacity and abuse prevention |
| Features | team invites, sharing, weekly digest | gradual product changes |
| Content | welcome message, banner, help URL | CMS-like customer communication |

## MVP acceptance criteria

MVP is complete when:

- a user can register, log in and edit a personal profile;
- each user belongs to a workspace with a role;
- unauthorized users cannot edit or publish settings;
- a parameter has a declared type and invalid values are rejected at runtime;
- every change creates an immutable version and audit event;
- the UI displays a meaningful diff before publish;
- the runtime endpoint returns only the active configuration;
- rollback restores a previous version without manual SQL;
- the dashboard has loading, empty, success and error states;
- critical use cases have unit, integration and e2e tests;
- the complete stack runs locally with Docker Compose;
- Terraform describes the AWS deployment;
- a public demo URL and setup documentation exist.

## Deliberate scope limits

The first release does not include payments, a marketplace, chat, a full customer-facing SaaS product, Kubernetes or AI features. The portfolio value comes from a finished, explainable control plane rather than a long list of disconnected technologies.

## Honest portfolio positioning

The deployed result can be described as an independently developed production-like B2B admin product based on a realistic business case. We should not claim it was a paid corporate system or that it went to market unless that is factually true.
