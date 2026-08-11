begin;

create table if not exists public.engagement_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null check (template_type in ('mission', 'reward')),
  title text not null,
  description text not null default '',
  points integer,
  verification_mode text,
  verification_key text,
  points_cost integer,
  quantity_total integer,
  threshold_points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engagement_templates_valid check (
    (
      template_type = 'mission'
      and points is not null and points >= 1
      and verification_mode in ('automatic', 'manual')
      and (verification_mode = 'manual' or verification_key is not null)
      and points_cost is null and quantity_total is null and threshold_points is null
    )
    or
    (
      template_type = 'reward'
      and points is null and verification_mode is null and verification_key is null
      and points_cost is not null and points_cost >= 0
      and quantity_total is not null and quantity_total >= 1
      and threshold_points is not null and threshold_points >= 0
    )
  )
);

alter table public.engagement_templates enable row level security;
revoke all on table public.engagement_templates from public, anon, authenticated;

comment on table public.engagement_templates is
  'Libreria amministrativa riutilizzabile di missioni e premi per eventi futuri.';

commit;
