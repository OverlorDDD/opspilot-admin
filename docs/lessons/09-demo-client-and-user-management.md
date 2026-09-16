# Урок 09 — Demo Client і керування користувачами

## Consumer

**Consumer / client** — інша програма, яка використовує наше API.

Flowline Dispatch не читає PostgreSQL або Redis напряму. Він знає тільки runtime endpoint:

```text
GET /api/configs/runtime
```

Це важливе розділення: на місці Demo Client міг би бути mobile app, worker, інший backend або окремий сайт.

## Runtime configuration

Замість:

```text
edit code → build → deploy
```

для певних операційних параметрів можна зробити:

```text
change config → approve → publish → client refreshes config
```

## User vs WorkspaceMember

- `User` — акаунт: email, name, password hash;
- `WorkspaceMember` — зв'язок user з workspace і його role.

Це дозволяє будувати RBAC у межах конкретного workspace.

## User Management

Owner/admin бачить зареєстровані demo-акаунти та може призначати role.

Backend додатково захищає небезпечні ситуації:

- користувач не може сам собі випадково змінити role;
- admin не може самовільно створити owner;
- останнього owner не можна понизити.

## Чому глобальний список users не завжди підходить SaaS

У внутрішній системі однієї компанії це зручно.

У multi-tenant SaaS компанія A не повинна бачити email користувачів компанії B. Тому production-рішення зазвичай показує members конкретного workspace та використовує invite-by-email.

## Що сказати на співбесіді

> Account і workspace membership розділені, а role assignment перевіряється на backend із захистом від privilege escalation та orphaned workspace без owner.
