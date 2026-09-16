# Урок 07 — Diff і безпечний rollback

## Diff

**Diff (difference)** показує, що змінилося між двома версіями.

```text
v1: 25
v2: 40
```

Diff:

```text
25 → 40
```

Для JSON перед порівнянням ми нормалізуємо порядок ключів, щоб однакові об'єкти не виглядали різними лише через порядок properties.

## Rollback

**Rollback** — повернення поведінки до попереднього відомого стану після невдалої зміни.

Ми не переписуємо стару revision і не робимо миттєвий production switch.

Безпечний сценарій:

```text
v1 = 25 ARCHIVED
v2 = 40 PUBLISHED

Restore v1
   ↓
v3 = 25 DRAFT
   ↓
Submit → Approve → Publish
```

## Чому створюємо нову revision

Так історія залишається зрозумілою:

```text
25 → 40 → 25
```

Ми бачимо, що зміна на 40 реально була, а потім її свідомо відкотили.

Це підтримує **immutability** історії: старі revisions не переписуються.

## Command endpoint

Restore змінює стан системи, тому використовує `POST`, наприклад:

```text
POST /api/configs/:id/revisions/:version/restore
```

## Що сказати на співбесіді

> Rollback не обходить approval: стара published revision копіюється в новий draft і проходить той самий workflow.
