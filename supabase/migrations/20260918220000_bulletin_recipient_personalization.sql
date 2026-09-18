-- Per-recipient personalization for bulletin news blocks

do $$ begin
  create type public.bulletin_personalization_mode as enum ('common', 'advanced');
exception when duplicate_object then null;
end $$;

alter table public.bulletins
  add column if not exists personalization_mode public.bulletin_personalization_mode not null default 'common';

alter table public.bulletin_recipients
  add column if not exists companies text[] not null default '{}',
  add column if not exists technologies text[] not null default '{}';
