# Backend (Express + MongoDB)

1. Copy `.env.example` to `.env` and set `MONGODB_URI`. Start MongoDB locally or create an Atlas cluster.
2. Set unique admin passwords and a strong `JWT_SECRET` before production.
3. Install with `npm install --prefix server`.
4. Run development API with `npm run dev --prefix server`; health endpoint: http://localhost:5000/api/health.
5. Run production with `npm start --prefix server`. For one-service hosting, build the frontend first and set `SERVE_STATIC=true`.
6. Optional Twilio alerts are configured only in this server `.env`; never expose credentials in frontend variables.

The customer payment-completed action updates the admin Socket.IO dashboard and sends best-effort Twilio alerts when configured. It does not verify or settle a payment. An administrator must confirm the actual bank transaction.
