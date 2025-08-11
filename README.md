# Alarm Watchtower

Web-based Alarm Tracking System for beltways to simulate, monitor, and analyze alarms. Runs offline with local storage or online with Supabase for realtime DB + history.

## Development

1) Install deps

```bash
npm i
```

2) Run dev server

```bash
npm run dev
```

3) Build

```bash
npm run build && npm run preview
```

## Supabase Setup (Realtime DB)

This app auto-detects Supabase envs and switches from local simulation to realtime DB.

### 1) Project URL and anon key

Create a Supabase project. From Project Settings → API, copy:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Create a `.env` file in repo root:

```bash
echo "VITE_SUPABASE_URL=YOUR_URL" >> .env
echo "VITE_SUPABASE_ANON_KEY=YOUR_KEY" >> .env
```

Restart `npm run dev` after adding envs.

### 2) Schema and trigger

Run this in Supabase SQL editor to create tables and an automatic history logger:

```sql
-- Alarms table
create table if not exists public.alarms (
  id text primary key,
  description text not null,
  status smallint not null default 0 check (status in (0,1)),
  last_status_change_time timestamptz not null default now()
);

-- Activation history
create table if not exists public.alarm_activations (
  id uuid primary key default gen_random_uuid(),
  alarm_id text not null references public.alarms(id) on delete cascade,
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz
);


## Design decisions

- Required two tabs with Overview and analysis
- Overview: Contains with all alarms and data and also option to activate to deactivate alarm 
- Analysis: proper logs for each alarm and also total number of mintes those alarams are in active state
- More Features: Add alarm(can add new type of alarm), Notify: to notify mnultiple people in different sectors when alarm is triggered with separed comma emails.(Try it out)
