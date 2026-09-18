# Урок 13. Безкоштовна публікація через Cloudflare Quick Tunnel

## Мета

Зробити локальний OpsPilot доступним з інтернету без платного хостингу.

Ми НЕ переносимо PostgreSQL, Redis або NestJS у хмару. Вони залишаються на твоєму ПК. Cloudflare Tunnel лише створює безпечний публічний HTTPS-вхід до локального Next.js.

Схема:

```text
Internet
   ↓
https://random-name.trycloudflare.com
   ↓
Cloudflare Tunnel
   ↓
Next.js localhost:3000
   ↓ /api/*
Next.js rewrite/proxy
   ↓
NestJS localhost:4000
   ↓
PostgreSQL + Redis у Docker
```

## Чому не GitHub Pages

GitHub Pages добре підходить для статичних сайтів. OpsPilot має NestJS API, JWT-cookie, PostgreSQL та Redis, тому лише статичного хостингу недостатньо.

## Same-origin proxy

Раніше браузер напряму звертався до:

```text
http://localhost:4000/api
```

Для іншої людини `localhost` означав би її власний комп'ютер.

Тому в public-demo режимі frontend використовує:

```text
/api
```

Next.js отримує цей запит і проксить його локально на:

```text
http://127.0.0.1:4000/api
```

Для браузера frontend та API мають одну адресу. Це спрощує cookies та CORS.

## Що таке reverse proxy

Reverse proxy — сервер-посередник, який приймає запит і пересилає його іншому серверу.

У нас Next.js тимчасово виконує цю роль для `/api/*`.

## Що таке tunnel

Tunnel — захищене вихідне з'єднання з твого ПК до Cloudflare. Не треба відкривати порт на роутері або робити port forwarding.

## Важливі обмеження Quick Tunnel

- URL випадковий і змінюється після нового запуску.
- ПК має бути увімкнений.
- `npm run dev`, Docker і `cloudflared` мають працювати.
- Це demo/testing режим, а не production-хостинг.
- Після зупинки `cloudflared` публічна адреса перестає працювати.

## Безпека demo

Не використовуй реальні робочі секрети або паролі. Пам'ятай, що публічну адресу може відкрити будь-хто, кому ти її дав.

## Запуск

У першому PowerShell:

```powershell
cd C:\Users\Note\Documents\opspilot-admin
.\scripts\start-public-demo.ps1
```

У другому PowerShell:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Cloudflare покаже адресу виду:

```text
https://something-random.trycloudflare.com
```

Її можна відкрити з телефона через мобільний інтернет або передати іншій людині.

## Як вимкнути публічний доступ

У вікні `cloudflared` натисни:

```text
Ctrl+C
```

Після цього tunnel закритий.

## Що сказати на співбесіді

> Для першого безкоштовного public demo я використав Cloudflare Quick Tunnel. Щоб не відкривати frontend та API двома різними доменами, я додав same-origin reverse proxy у Next.js: браузер звертається до `/api`, а Next.js проксить запити на локальний NestJS. Це дозволяє зберегти JWT cookies і не відкривати backend-порт напряму в інтернет.
