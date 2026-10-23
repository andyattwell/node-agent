# API (Backend)

Node.js + Express + TypeScript backend.

## Run

```bash
npm install
npm run dev
```

Server runs at http://localhost:3000 (set `PORT` to override).

## Scripts

- `npm run dev` - start with hot reload (tsx watch)
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run built output (`node dist/index.js`)

## Endpoints

- `GET /` - health check, returns `{ "status": "ok" }`
- `GET /health` - same
