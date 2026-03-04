# PortalIT

MSP management portal built with React + Supabase + Express.

## Architecture

- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js (hosted on Railway)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email + password)
- **Storage**: Supabase Storage
- **LLM**: Anthropic Claude

## Local Development

### Prerequisites

1. Clone the repository
2. Install frontend dependencies: `npm install`
3. Install backend dependencies: `cd server && npm install`
4. Create `.env.local` for frontend and `server/.env` for backend (see `.env.example` files)

### Running

```bash
# Frontend
npm run dev

# Backend
cd server && npm start
```

## Deployment

- **Frontend**: Build with `npm run build`, deploy static files to Railway
- **Backend**: Deploy `server/` to Railway
- **Database**: Run migrations in `supabase/migrations/` against your Supabase project
