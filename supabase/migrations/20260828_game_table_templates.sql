begin;

create table if not exists public.game_table_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  normalized_name text generated always as (lower(btrim(name))) stored,
  interest_tags text[] not null default '{}',
  points_reward smallint not null default 3 check (points_reward between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_table_templates_name_key unique (normalized_name),
  constraint game_table_templates_interests_check
    check (cardinality(interest_tags) between 1 and 12)
);

alter table public.game_table_templates enable row level security;

revoke all on table public.game_table_templates
from public, anon, authenticated;

create index if not exists game_table_templates_updated_idx
  on public.game_table_templates(updated_at desc);

commit;
