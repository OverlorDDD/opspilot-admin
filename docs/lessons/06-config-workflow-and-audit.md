# Урок 06 — Draft → Approval → Publish, versioning і Audit Log

## Чому простого PATCH недостатньо

Якщо просто перезаписувати production value, ми втрачаємо історію і не знаємо, хто схвалив зміну.

Тому OpsPilot використовує workflow:

```text
DRAFT
  ↓ Submit
PENDING_APPROVAL
  ↓ Approve
APPROVED
  ↓ Publish
PUBLISHED
```

Також є `REJECTED` і `ARCHIVED`.

## Draft

**Draft** — чернетка. Вона ще не впливає на runtime-клієнтів.

```text
Published v1 = 25
Draft     v2 = 40
```

Flowline Dispatch продовжує отримувати `25`, доки v2 не буде опублікована.

## Revision / versioning

`ConfigEntry` — сам параметр.

`ConfigRevision` — конкретна версія його значення.

```text
v1 = 25 ARCHIVED
v2 = 40 PUBLISHED
```

## Audit Log

**Audit Log** — незмінний журнал важливих дій:

```text
DRAFT_CREATED
DRAFT_SUBMITTED
DRAFT_APPROVED
CONFIG_PUBLISHED
```

Він відповідає на питання:

```text
хто?
що зробив?
коли?
з якою сутністю?
```

## Transaction

Publish змінює кілька записів. Ми використовуємо database transaction:

```text
або виконуються всі кроки
або не виконується жоден
```

Це захищає від напівзбереженого стану.

## Що сказати на співбесіді

> Critical configuration changes проходять approval workflow, версіонуються, виконуються транзакційно і записуються в append-only audit history.
