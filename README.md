# FoodExpress - a Monolithic Online Food Ordering App

A small but realistic web application for teaching **monolithic architecture**. One Node.js (Express) program serves the website, the JSON APIs, the order logic and the confirmation emails. There is no React, no separate backend service and no database.

> **Demo only.** No payment is collected, and orders live **in the server's memory** - they are lost whenever the application restarts.

- **Backend:** Node.js 20+, Express, Nodemailer, dotenv, Helmet (security headers)
- **Frontend:** plain HTML, CSS and vanilla JavaScript (served by the same Express app)
- **Storage:** in-memory arrays/maps (menu and orders)
- **Target deployment:** one AWS EC2 instance running Amazon Linux 2023

---

## 1. What is a monolithic architecture?

A **monolith** is an application built and deployed as **one single unit**. All features - UI, business logic, email, data access - live in one codebase and run in one process.

```
                    ONE deployable application (one Node.js process)
 ┌───────────────────────────────────────────────────────────────────────┐
 │                                                                       │
 │  Browser ──HTTP──►  Express server (server.js)                        │
 │                      │                                                │
 │                      ├─ static files  → public/*.html, css, js        │
 │                      ├─ routes/       → /api/products, /api/orders    │
 │                      ├─ services/     → validation, pricing, orders   │
 │                      │                  └─► emailService → SMTP      │
 │                      └─ data/         → menu + in-memory order store  │
 │                                                                       │
 └───────────────────────────────────────────────────────────────────────┘
```

| Advantages | Trade-offs |
|---|---|
| Simple to build, run and debug (`npm start`) | The whole app is deployed together, even for a tiny change |
| One deployment, one log, one place to look | Scaling means running more copies of everything |
| Function calls instead of network calls between parts | A problem in one part (e.g. memory) can affect all parts |
| Easy to understand for beginners | Large monoliths can get tangled without discipline |

In this project the "parts" are still separated into folders (`routes/`, `services/`, `data/`) - a **modular monolith** - but they are deployed as one app.

## 2. How an order flows through the system

1. The customer opens the site; the browser loads `public/*.html`, CSS and JS **from the same server**.
2. The frontend calls `GET /api/products` to get the menu.
3. The customer adds items to the cart (kept in the browser's `localStorage`: only product IDs and quantities).
4. At checkout the customer enters name, email, phone and delivery address.
5. The frontend sends `POST /api/orders` with **product IDs + quantities + customer details** - never prices.
6. `routes/orders.js` hands the request to `services/orderService.js`, which:
   - validates and cleans the input (`services/validation.js`),
   - looks up **trusted prices on the server** (`data/products.js`) and calculates the total,
   - creates the order with a unique ID (e.g. `FE-7K3M9QXA`) and status `BOOKED`, and stores it in memory (`data/orderStore.js`).
7. `services/emailService.js` tries to send the confirmation email through SMTP.
8. The API replies `201 Created` with the order and the **real** email status.
9. Only then does the browser go to the confirmation page, which re-reads the order from `GET /api/orders/:id` and shows the order ID, items, total and email status.

If the email fails, the order is **kept**; the page says *"booked, but the confirmation email could not be sent"* and offers a retry button that calls `POST /api/orders/:id/resend-email` - this re-sends for the *same* order and never creates a duplicate.

## 3. Project structure

```
server.js                  Starts Express: security headers, JSON parsing, routes, static files, error handling
config.js                  Reads environment variables (.env) in one place
routes/
  products.js              GET /api/products, GET /api/products/:id
  orders.js                POST /api/orders, GET /api/orders/:id, POST /api/orders/:id/resend-email
services/
  orderService.js          Business logic: trusted pricing, creating orders, email retries
  validation.js            Input validation + cleaning
  emailService.js          Nodemailer: builds and sends the confirmation email (or prints a dev preview)
data/
  products.js              The food menu (12 items, in memory)
  orderStore.js            In-memory orders + unique order ID generator
middleware/
  errorHandler.js          Safe JSON errors (no stack traces for clients) + 404 handling
  rateLimit.js             Tiny per-IP rate limiter
public/                    The frontend (served as static files)
  index.html  menu.html  checkout.html  order-success.html  orders.html
  css/style.css
  js/common.js             Header/footer, API helper, cart (localStorage)
  js/menu-card.js          Food card used on Home and Menu
  js/home.js  menu.js  checkout.js  order-view.js  order-success.js  orders.js
test/                      Automated API tests (node:test)
deploy/setup-ec2.sh        Amazon Linux 2023 setup script (Node.js + systemd service)
.env.example               Template for configuration (copy to .env)
```

## 4. Run it locally

Requirements: **Node.js 20 or newer** (`node -v`).

```bash
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
npm start                 # or: npm run dev  (auto-restart on file changes)
```

Open <http://localhost:3000>.

With no SMTP settings and `NODE_ENV=development`, the server prints a clearly labelled **EMAIL PREVIEW** in the terminal after each order. **No real email is sent**, and the website says so.

Run the tests (they do not need a network or SMTP):

```bash
npm test
```

> ⚠️ **Do not keep `node_modules` inside Google Drive / OneDrive / Dropbox folders.** Cloud-sync drives can corrupt files written during `npm install` (we saw empty `package.json` files inside `node_modules`). Work in a normal local folder.

## 5. Configuration (`.env`)

| Variable | Meaning | Example |
|---|---|---|
| `PORT` | Port the app listens on | `3000` |
| `NODE_ENV` | `development` (email preview allowed) or `production` | `production` |
| `TRUST_PROXY` | `1` when behind Nginx/ALB so client IPs are correct | `0` |
| `SMTP_HOST` | SMTP server. **Leave empty** for dev preview mode | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | `false` = STARTTLS (port 587), `true` = TLS (port 465) | `false` |
| `SMTP_USER` / `SMTP_PASS` | SMTP login (never commit these) | |
| `EMAIL_FROM` | Sender shown to the customer | `"FoodExpress <orders@yourdomain.com>"` |
| `RATE_LIMIT_ORDERS_PER_MIN` | Optional: max order requests per IP per minute | `60` |

`.env` is listed in `.gitignore`. Secrets are only ever read on the server - they never reach the browser or API responses.

### Test a real email

1. Choose an SMTP provider. For Gmail: turn on 2-Step Verification, create an **App Password**, then use `smtp.gmail.com`, port `587`, `SMTP_SECURE=false`, your address as `SMTP_USER`, and the app password as `SMTP_PASS`. (Amazon SES, Mailgun, Brevo, or a local tool like [Mailpit](https://mailpit.axllent.org/) on `localhost:1025` also work.)
2. Fill in `.env` and restart the app.
3. Check `http://localhost:3000/health` shows `"emailConfigured": true`.
4. Place an order using **your own** email address. The confirmation page shows *"A confirmation email has been sent…"* only if the SMTP server accepted the message.

Email statuses shown to customers:

| Status | When | What the user sees |
|---|---|---|
| `SENT` | SMTP accepted the email | "A confirmation email has been sent" |
| `PREVIEW_LOGGED` | Development, no SMTP | "No real email was sent - a preview was printed to the server console" |
| `NOT_CONFIGURED` | Production, no SMTP | "Order is booked, but the email could not be sent…" |
| `FAILED` | SMTP configured but sending failed | "Order is booked, but the email could not be sent" + retry button |

## 6. API reference

Errors always look like `{ "error": { "code": "...", "message": "...", "details": { ... } } }`.

### `GET /health`
```bash
curl http://localhost:3000/health
```
```json
{ "status": "ok", "uptimeSeconds": 42, "timestamp": "2026-10-09T10:00:00.000Z", "environment": "development", "emailConfigured": false }
```

### `GET /api/products`
```bash
curl http://localhost:3000/api/products
```
```json
{
  "categories": ["Pizza", "Burgers", "Indian", "Chinese", "Desserts"],
  "products": [
    { "id": 1, "name": "Margherita Pizza", "category": "Pizza", "price": 299,
      "image": "https://images.unsplash.com/...", "description": "Classic hand-stretched pizza..." }
  ]
}
```

### `GET /api/products/:id`
```bash
curl http://localhost:3000/api/products/6      # 200 → one product
curl http://localhost:3000/api/products/999    # 404 → PRODUCT_NOT_FOUND
```

### `POST /api/orders`
Only `productId` and `quantity` (1-10) are read from each item. Any price sent by the client is **ignored**.
```bash
curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" -d '{
  "customer": { "name": "Asha Rao", "email": "asha@example.com", "phone": "+91 98765 43210",
                "address": "12 Park Street, Kolkata 700016" },
  "items": [ { "productId": 1, "quantity": 2 }, { "productId": 5, "quantity": 1 } ]
}'
```
`201 Created`:
```json
{
  "message": "Order booked successfully.",
  "order": {
    "id": "FE-7K3M9QXA", "status": "BOOKED", "createdAt": "2026-10-09T10:00:00.000Z",
    "customer": { "name": "Asha Rao", "email": "a***@example.com", "phone": "*******210" },
    "items": [
      { "productId": 1, "name": "Margherita Pizza", "quantity": 2, "unitPrice": 299, "lineTotal": 598 },
      { "productId": 5, "name": "French Fries", "quantity": 1, "unitPrice": 99, "lineTotal": 99 }
    ],
    "total": 697,
    "email": { "status": "PREVIEW_LOGGED", "message": "Email is not configured on this server (development mode). ...", "canResend": false }
  }
}
```
`400 Bad Request` (validation):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please fix the highlighted problems and try again.",
             "details": { "email": "Please enter a valid email address, e.g. name@example.com.",
                          "items": "Item 1: quantity must be a whole number from 1 to 10." } } }
```
Other codes: `413` body larger than 10 KB, `429` too many requests.

### `GET /api/orders/:id`
```bash
curl http://localhost:3000/api/orders/FE-7K3M9QXA   # 200 → order (same shape as above), or 404 ORDER_NOT_FOUND
```
For privacy, lookups return a masked email and phone and **do not** return the delivery address.

### `POST /api/orders/:id/resend-email`
Retries the confirmation email for an existing order (never creates a new order). Returns `409` if the email was already sent, `429` during the 30-second cool-down or after 5 attempts.

## 7. Deploy to AWS EC2 (Amazon Linux 2023)

1. **Launch an instance** (e.g. `t3.micro`) with the *Amazon Linux 2023* AMI.
2. **Security group (inbound rules):**

   | Port | Source | Why |
   |---|---|---|
   | 22 (SSH) | **Your IP only** (`x.x.x.x/32`) | Administration |
   | 3000 (TCP) | `0.0.0.0/0` | Quick demo access directly to the app |
   | 80 / 443 (TCP) | `0.0.0.0/0` | Only when you add Nginx + HTTPS (below); then **remove the port 3000 rule** |

   Outbound: allow all (the app needs to reach your SMTP server on 587/465).
   If you don't have an outbound-email path, note that AWS blocks port 25 by default - use 587/465.
3. **Copy the project to the server** (git clone, or `scp`/`rsync`), then:
   ```bash
   cd food-ordering-app            # your project folder on the server
   sudo ./deploy/setup-ec2.sh
   # optional settings:  sudo APP_DIR=/srv/foodexpress APP_PORT=8080 ./deploy/setup-ec2.sh
   ```
   The script installs Node.js 20+, copies the app to `APP_DIR` (default `/opt/foodexpress`), runs `npm ci --omit=dev`, creates a `systemd` service (`foodexpress`) that **starts on boot and restarts on failure**, and creates `.env` **only if it doesn't already exist**. It never overwrites or prints `.env`.
4. **Configure SMTP separately** (the script does not ask for or print secrets):
   ```bash
   sudo nano /opt/foodexpress/.env     # set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM
   sudo systemctl restart foodexpress
   curl http://127.0.0.1:3000/health   # "emailConfigured": true
   ```
5. Browse to `http://<EC2-public-IP>:3000`.

Handy commands: `sudo systemctl status foodexpress`, `sudo journalctl -u foodexpress -f`, `sudo systemctl restart foodexpress`.
To deploy a new version, update the project files on the server and run the script again (it keeps your `.env`).

> The service runs with `NODE_ENV=production`, so a missing SMTP configuration is reported honestly ("email could not be sent") instead of faking a preview.

### Production: reverse proxy and HTTPS

Plain HTTP on port 3000 is fine for a classroom demo, but real sites should put **Nginx** in front of the app and use **HTTPS**. Nginx terminates TLS and forwards requests to Node on `127.0.0.1:3000`.

```bash
sudo dnf install -y nginx
sudo tee /etc/nginx/conf.d/foodexpress.conf >/dev/null <<'EOF'
server {
    listen 80;
    server_name food.example.com;          # your domain, pointing to the EC2 Elastic IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo systemctl enable --now nginx
```

Then:
1. Set `TRUST_PROXY=1` in `.env` and restart the app, so rate limiting sees real client IPs.
2. Point your domain's DNS **A record** to an **Elastic IP** attached to the instance.
3. Get a free certificate with Let's Encrypt (Certbot is not in the Amazon Linux 2023 repositories, so install it with pip):
   ```bash
   sudo dnf install -y python3-pip augeas-libs
   sudo python3 -m venv /opt/certbot && sudo /opt/certbot/bin/pip install certbot certbot-nginx
   sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot
   sudo certbot --nginx -d food.example.com
   ```
   Certbot edits the Nginx config for HTTPS and sets up renewal (check it with `sudo certbot renew --dry-run`; add a cron/systemd timer for `certbot renew` if none exists).
4. Close port 3000 in the security group (only 80/443 should be public), or bind the app to localhost only.

Alternatively use an **Application Load Balancer + AWS Certificate Manager** for HTTPS.

## 8. Troubleshooting

| Problem | What to check |
|---|---|
| `Cannot find module 'express'` | Run `npm install` in the project folder. |
| `Invalid package config ...package.json` / empty files in `node_modules` | The project is in a cloud-sync folder (Google Drive etc.). Move it to a normal local folder and reinstall. |
| `EADDRINUSE: address already in use :::3000` | Another program uses the port. Change `PORT` in `.env`, or stop the other process. |
| Order is booked but "email could not be sent" | Check the server log (`journalctl -u foodexpress` on EC2). Common causes: wrong `SMTP_USER`/`SMTP_PASS` (Gmail needs an *App Password*), wrong port/`SMTP_SECURE` pair (587 → `false`, 465 → `true`), or the network blocks outbound SMTP. Then use the **retry** button on the confirmation page. |
| No email and the console shows "EMAIL PREVIEW" | `SMTP_HOST` is empty and `NODE_ENV=development`. That's expected - no real email is sent. |
| Email lands in spam | Use a proper domain/sender (SES, SPF/DKIM). Free Gmail senders are often flagged. |
| "We could not find an order with that ID" | Orders are in memory only and vanish on restart; also check the ID (e.g. `FE-7K3M9QXA`). |
| Can't open the site from the internet | Security group must allow the port; `sudo systemctl status foodexpress` must show *active (running)*; the OS firewall isn't enabled by default on AL2023. |
| Food images missing | Images come from `images.unsplash.com`; the browser needs internet access. A placeholder icon appears if an image can't load. |
| `429 Too many requests` | The simple rate limiter was triggered. Wait a minute or raise `RATE_LIMIT_ORDERS_PER_MIN`. |
| Service keeps restarting | `sudo journalctl -u foodexpress -n 100 --no-pager` shows the error (often a bad `.env`). |

## 9. Security notes

- Prices are **always** calculated on the server from `data/products.js`; the browser only sends product IDs and quantities.
- Inputs are validated (names, email, phone, address, product IDs, integer quantities 1-10), control characters are stripped, and values are HTML-escaped in emails; the frontend builds pages with `textContent`, not `innerHTML`.
- Request bodies are limited to 10 KB; order endpoints are rate-limited per IP.
- Helmet adds security headers, including a Content-Security-Policy that only allows scripts/styles from the app itself and images from itself and Unsplash.
- Errors returned to clients never include stack traces or secrets; details go to the server log only.
- Order lookups return masked contact details and no address, and order IDs are random (not sequential), so they cannot be guessed easily.
- No real payments are processed and no more personal data than needed is collected.

## 10. Ideas for next steps (for students)

Replace the in-memory store with a database (SQLite/PostgreSQL), add user accounts, order status updates (PREPARING → DELIVERED), an admin page, then discuss which parts could become separate services if the app grew - and what that would cost.
