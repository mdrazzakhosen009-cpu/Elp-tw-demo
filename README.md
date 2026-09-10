# Trend Wear — Production Website v2

Premium, database-driven fashion ecommerce website for Render + Turso.

## Included systems
- Premium responsive storefront
- Database-driven editable landing sections
- Secure `/admin` login with JWT httpOnly cookie
- Admin dashboard
- Product CRUD + stock + featured/visibility + gallery URLs
- Category CRUD
- Order creation, stock validation and atomic stock decrement
- COD + configurable bKash/Nagad/Rocket manual payment flow
- Payment sender number + transaction ID collection for manual payments
- Order tracking by order code
- Contact/lead form
- Store, SEO, social, delivery and payment settings
- Admin password change
- Login rate limiting
- Mobile cart drawer + checkout modal with working close/backdrop/Escape controls

## Render
Build command:
```text
npm install
```
Start command:
```text
npm start
```

Required environment variables:
```text
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
JWT_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
NODE_ENV=production
SITE_URL=https://your-service.onrender.com
```
`ADMIN_PASSWORD` must be at least 10 characters.

Admin URL:
```text
https://YOUR-RENDER-DOMAIN/admin
```

## Turso
The application creates its required tables automatically on startup. No seed/demo products are inserted. Add real categories and products from the Admin Panel.

## Images
This version intentionally does not depend on Cloudflare R2. Product, category and landing images are managed through image URL fields, while the supplied Trend Wear logo is bundled as an image file.

## Important
Every visible ecommerce/admin action is connected to a real API/database operation. The site does not intentionally include fake demo buttons or fake order success states.
