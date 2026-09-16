# Урок 05 — Workspace і RBAC

## Workspace

**Workspace** — робочий простір конкретної команди або компанії.

Наприклад:

```text
Flowline Operations
```

Конфігурації та права користувачів прив'язані саме до workspace.

## RBAC

**RBAC (Role-Based Access Control)** — контроль доступу на основі ролі.

У OpsPilot є:

```text
owner
admin
editor
approver
viewer
```

Приклад прав:

- `editor` — створює/редагує draft і відправляє його на approval;
- `approver` — approve/reject;
- `viewer` — лише читає;
- `owner/admin` — мають розширені адміністративні права.

## WorkspaceMember

`User` і `WorkspaceMember` — різні поняття.

```text
User
  ↓
WorkspaceMember(role=editor)
  ↓
Workspace
```

`User` відповідає на питання «хто це?», а membership — «що він може робити в цьому workspace?».

## Guard

`WorkspaceRoleGuard` перевіряє role на backend.

Навіть якщо користувач вручну відправить заборонений HTTP request, API поверне `403 Forbidden`.

## Least privilege

**Least privilege** — давати користувачу мінімальні права, потрібні для роботи. Тому новий member краще починає з `viewer`, а потім owner підвищує role.

## Що сказати на співбесіді

> Авторизація workspace-scoped: права визначаються membership-ом, а backend Guard блокує операції, на які роль не має permission.
