alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

alter table public.bulletins
  add column if not exists subject text not null default '';

update public.profiles
set
  first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
  last_name = coalesce(last_name, nullif(regexp_replace(full_name, '^[^ ]+\\s*', ''), ''));
