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

-- Trigger to maintain activation windows
create or replace function public.handle_alarm_toggle()
returns trigger as $$
declare
  prev_status smallint;
  next_status smallint;
begin
  prev_status := coalesce(old.status, 0);
  next_status := new.status;
  if prev_status = 0 and next_status = 1 then
    insert into public.alarm_activations (alarm_id, activated_at)
    values (new.id, new.last_status_change_time);
  end if;
  if prev_status = 1 and next_status = 0 then
    update public.alarm_activations aa
    set deactivated_at = new.last_status_change_time
    where aa.id = (
      select id from public.alarm_activations
      where alarm_id = new.id and deactivated_at is null
      order by activated_at desc
      limit 1
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_alarm_toggle on public.alarms;
create trigger trg_alarm_toggle
after update of status on public.alarms
for each row execute function public.handle_alarm_toggle();

-- Seed 10 alarms
insert into public.alarms (id, description, status, last_status_change_time)
select * from (values
  ('ALM-001','Alarm 1 — Monitoring point',0, now()),
  ('ALM-002','Alarm 2 — Monitoring point',0, now()),
  ('ALM-003','Alarm 3 — Monitoring point',0, now()),
  ('ALM-004','Alarm 4 — Monitoring point',0, now()),
  ('ALM-005','Alarm 5 — Monitoring point',0, now()),
  ('ALM-006','Alarm 6 — Monitoring point',0, now()),
  ('ALM-007','Alarm 7 — Monitoring point',0, now()),
  ('ALM-008','Alarm 8 — Monitoring point',0, now()),
  ('ALM-009','Alarm 9 — Monitoring point',0, now()),
  ('ALM-010','Alarm 10 — Monitoring point',0, now())
) as t(id, description, status, last_status_change_time)
on conflict (id) do nothing;

-- Analytics function: totals per alarm within a time window
create or replace function public.alarm_analytics(start_ts timestamptz, end_ts timestamptz)
returns table (
  id text,
  total_ms bigint,
  activations integer
) as $$
begin
  return query
  select a.id,
         coalesce(
           sum(
             extract(epoch from (
               least(coalesce(act.deactivated_at, end_ts), end_ts)
               - greatest(act.activated_at, start_ts)
             ))
           ) filter (
             where act.activated_at <= end_ts and coalesce(act.deactivated_at, end_ts) >= start_ts
           ),
           0
         )::bigint,
         coalesce(
           count(*) filter (
             where act.activated_at <= end_ts and coalesce(act.deactivated_at, end_ts) >= start_ts
           ),
           0
         )::int
  from public.alarms a
  left join public.alarm_activations act
    on act.alarm_id = a.id
  group by a.id
  order by a.id;
end;
$$ language plpgsql stable;

