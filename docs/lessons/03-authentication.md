# Урок 03 — Реєстрація, login, JWT і cookie

## Навіщо потрібна authentication

Admin-система змінює поведінку продукту, тому сервер повинен знати, **хто саме виконує запит**.

Форма login сама по собі не є security. Справжня перевірка відбувається на backend.

## Реєстрація

Користувач надсилає email, пароль та ім'я:

```text
POST /api/auth/register
```

Пароль не зберігається як звичайний текст. Backend робить **hash** через bcrypt і зберігає лише hash.

## JWT

**JWT (JSON Web Token)** — підписаний цифровий пропуск. У ньому можна зберегти, наприклад, `userId`.

Після login NestJS створює JWT і віддає його браузеру в cookie.

## Cookie

Cookie — маленьке значення, яке браузер автоматично надсилає сайту під час запитів.

Наша auth-cookie має важливі параметри:

- `httpOnly` — JavaScript сторінки не може напряму прочитати JWT;
- `sameSite=lax` — додатковий захист від небажаних cross-site запитів;
- `secure=true` у production — cookie передається лише через HTTPS.

## JwtAuthGuard

Guard у NestJS — перевірка перед controller.

```text
Request
  ↓
JwtAuthGuard
  ↓
JWT valid?
  ↓ yes
Controller
```

Якщо cookie немає або JWT неправильний — API повертає `401 Unauthorized`.

## 401 і 403 — не одне й те саме

- `401 Unauthorized` — система не знає, хто ти, або token недійсний.
- `403 Forbidden` — система знає, хто ти, але тобі не дозволена ця дія.

## Що сказати на співбесіді

> Я використовую JWT у httpOnly cookie, а protected endpoints захищаю NestJS Guard-ами. Frontend не є джерелом security-рішень — backend повторно перевіряє доступ.
