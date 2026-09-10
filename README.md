# Trend Wear BD — Fully Usable / Editable Fashion Store

Production-oriented full-stack starter for **Trend Wear BD**, using the selected premium editorial fashion direction and the supplied logo.

## Architecture
- React + Vite customer website
- Express API
- **Turso / libSQL** database
- Cloudflare R2 / S3-compatible object storage for images
- HTTP-only JWT admin session
- bcrypt password hashing
- Rate limiting + Zod validation
- Render-ready single Node service

## Admin controls
Dashboard, products, categories, orders, landing-page editor, banners, services, reviews with image upload, leads, social links and store/payment/contact settings.

## Editable landing page
Homepage sections are stored in Turso and rendered in database `sort_order`. Admin can edit title/description/content JSON, upload section images, toggle visibility and reorder sections. The supplied review behavior is a horizontal auto-scrolling review strip; admins can add/edit/delete reviews and upload customer photos.

## Environment
Copy `.env.example` and provide:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `AUTH_SECRET`
- R2 variables for image upload

Never commit real secrets to GitHub.

## Local
```bash
npm install
npm run create-admin -- admin@example.com StrongPassword "Trend Wear BD Admin"
npm run dev
```

## Production
Build: `npm run build`
Start: `npm start`

### Important
The project was updated to the Turso/libSQL architecture. Dependencies could not be fully installed/tested in the generation environment because `npm install` timed out, so run `npm install` in your development/Render environment and then run the build before deployment.
