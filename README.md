# Trend Wear

Premium white/black fashion ecommerce website for Render + Turso.

## Local
1. Copy `.env.example` to `.env`.
2. Set Turso credentials and a strong `JWT_SECRET`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
4. Run `npm install`.
5. Run `npm run db:init`.
6. Run `npm start`.
7. Open `http://localhost:3000`.

## Render
Use the included `render.yaml`, or create a Node Web Service:
- Build: `npm install`
- Start: `npm start`

Add the environment variables from `.env.example` in Render. Never commit real secrets.

The app automatically creates/migrates its Turso tables on startup. The admin account is created/updated from the server environment on startup.

## Admin
`/admin`
Use the configured `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Notes
- The supplied Trend Wear logo is kept as the original image file in `public/assets/trend-wear-logo.jpg`.
- No SVG logo is generated.
- Product image management uses image URLs so assets remain durable on Render without R2.
- Orders, customers, products, categories, settings, landing sections and admin credentials are stored in Turso.
- Manual payment methods are supported as order metadata; the system does not falsely mark payments as successful.
