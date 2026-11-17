-- Smart Warehouse schema
-- Jalankan di Supabase Dashboard > SQL Editor pada project yang benar.
-- Aman dijalankan ulang: tabel dan data inventaris yang ada dipertahankan.
-- Membuat model awal, fungsi simpan atomik, RLS, dan publikasi realtime.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create table if not exists public.device_models (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_models_code_nonempty check (length(trim(code)) > 0),
  constraint device_models_label_nonempty check (length(trim(label)) > 0)
);

create table if not exists public.boxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  box_number text not null unique,
  model_id uuid not null references public.device_models(id) on update cascade on delete restrict,
  status text not null default 'confirmed' check (status in ('confirmed', 'review')),
  scanned_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxes_name_nonempty check (length(trim(name)) > 0),
  constraint boxes_number_format check (box_number ~ '^[0-9]{8,30}$')
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.boxes(id) on update cascade on delete cascade,
  unit_sequence integer not null,
  mac_address text,
  serial_number text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_unit_sequence_positive check (unit_sequence > 0),
  constraint devices_serial_format check (serial_number ~ '^[0-9]{12}$'),
  constraint devices_mac_format check (mac_address is null or mac_address ~* '^[0-9a-f]{12}$'),
  constraint devices_box_sequence_unique unique (box_id, unit_sequence)
);

create unique index if not exists devices_mac_address_unique
  on public.devices (upper(mac_address))
  where mac_address is not null;

create index if not exists boxes_model_scanned_at_idx
  on public.boxes (model_id, scanned_at desc);

create index if not exists devices_box_id_idx
  on public.devices (box_id, unit_sequence);

drop trigger if exists device_models_set_updated_at on public.device_models;
create trigger device_models_set_updated_at
  before update on public.device_models
  for each row execute function public.set_updated_at();

drop trigger if exists boxes_set_updated_at on public.boxes;
create trigger boxes_set_updated_at
  before update on public.boxes
  for each row execute function public.set_updated_at();

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

alter table public.device_models enable row level security;
alter table public.boxes enable row level security;
alter table public.devices enable row level security;

-- Hak akses untuk pengguna yang login. Akses anon tidak diberikan.
drop policy if exists "Authenticated users can read device models" on public.device_models;
create policy "Authenticated users can read device models"
  on public.device_models for select to authenticated using (true);

drop policy if exists "Authenticated users can manage device models" on public.device_models;
create policy "Authenticated users can manage device models"
  on public.device_models for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can read boxes" on public.boxes;
create policy "Authenticated users can read boxes"
  on public.boxes for select to authenticated using (true);

drop policy if exists "Authenticated users can insert boxes" on public.boxes;
create policy "Authenticated users can insert boxes"
  on public.boxes for insert to authenticated with check (created_by is null or created_by = (select auth.uid()));

drop policy if exists "Authenticated users can update boxes" on public.boxes;
create policy "Authenticated users can update boxes"
  on public.boxes for update to authenticated using (true)
  with check (true);

drop policy if exists "Authenticated users can delete boxes" on public.boxes;
create policy "Authenticated users can delete boxes"
  on public.boxes for delete to authenticated using (true);

drop policy if exists "Authenticated users can read devices" on public.devices;
create policy "Authenticated users can read devices"
  on public.devices for select to authenticated using (true);

drop policy if exists "Authenticated users can insert devices" on public.devices;
create policy "Authenticated users can insert devices"
  on public.devices for insert to authenticated with check (
    exists (select 1 from public.boxes b where b.id = box_id)
  );

drop policy if exists "Authenticated users can update devices" on public.devices;
create policy "Authenticated users can update devices"
  on public.devices for update to authenticated using (true) with check (
    exists (select 1 from public.boxes b where b.id = box_id)
  );

drop policy if exists "Authenticated users can delete devices" on public.devices;
create policy "Authenticated users can delete devices"
  on public.devices for delete to authenticated using (true);

-- Model awal sesuai dropdown aplikasi saat ini.
insert into public.device_models (code, label)
values
  ('ROUTER OUTDOOR T3000', 'Router Outdoor T3000'),
  ('ROUTER OUTDOOR MC7500', 'Router Outdoor MC7500'),
  ('MF296A2', 'MF296A2')
on conflict (code) do update set label = excluded.label;

-- Explicit grants keep the API usable even when default privileges differ.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.device_models, public.boxes, public.devices to authenticated;

-- Device changes made outside the UI must also invalidate an open box editor.
create or replace function public.touch_device_box()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.boxes set updated_at = clock_timestamp() where id = old.box_id;
  end if;
  if tg_op = 'INSERT' then
    update public.boxes set updated_at = clock_timestamp() where id = new.box_id;
  elsif tg_op = 'UPDATE' and new.box_id is distinct from old.box_id then
    update public.boxes set updated_at = clock_timestamp() where id = new.box_id;
  end if;
  return null;
end;
$$;

drop trigger if exists devices_touch_box on public.devices;
create trigger devices_touch_box
  after insert or update or delete on public.devices
  for each row execute function public.touch_device_box();

-- One RPC = one transaction. Any invalid/duplicate device rolls back the
-- entire operation, including the box and its previous list of devices.
create or replace function public.save_warehouse_box(
  payload jsonb,
  target_box_id uuid default null,
  expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_model uuid;
  saved_box_id uuid;
  current_version timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Masuk dengan akun operator sebelum menyimpan data.' using errcode = '42501';
  end if;
  if coalesce(jsonb_typeof(payload->'devices'), '') <> 'array' then
    raise exception 'Daftar perangkat wajib diisi.';
  end if;
  if jsonb_array_length(payload->'devices') = 0 then
    raise exception 'Isi minimal satu perangkat dengan SN 12 digit.';
  end if;
  if coalesce(trim(payload->>'name'), '') = '' then
    raise exception 'Nama box wajib diisi.';
  end if;
  select id into selected_model from public.device_models
    where code = payload->>'model_code' and is_active = true;
  if selected_model is null then
    raise exception 'Model device tidak tersedia. Pilih model yang aktif.';
  end if;

  if target_box_id is null then
    insert into public.boxes (name, box_number, model_id, status, created_by)
      values (trim(payload->>'name'), trim(payload->>'box_number'), selected_model,
        coalesce(payload->>'status', 'confirmed'), auth.uid())
      returning id into saved_box_id;
  else
    select updated_at into current_version from public.boxes
      where id = target_box_id for update;
    if not found then
      raise exception 'Box sudah dihapus atau tidak dapat diakses.';
    end if;
    if expected_updated_at is null or current_version is distinct from expected_updated_at then
      raise exception 'Data box telah berubah di tab lain. Batalkan edit lalu periksa data terbaru.';
    end if;
    update public.boxes set name = trim(payload->>'name'),
      box_number = trim(payload->>'box_number'), model_id = selected_model,
      status = coalesce(payload->>'status', 'confirmed')
      where id = target_box_id;
    if not found then
      raise exception 'Tidak memiliki izin mengubah box.' using errcode = '42501';
    end if;
    saved_box_id := target_box_id;
    delete from public.devices where box_id = saved_box_id;
  end if;

  insert into public.devices (box_id, unit_sequence, mac_address, serial_number)
    select saved_box_id, position::integer,
      nullif(upper(trim(device->>'mac_address')), ''), trim(device->>'serial_number')
    from jsonb_array_elements(payload->'devices') with ordinality as items(device, position);
  return saved_box_id;
end;
$$;

revoke all on function public.save_warehouse_box(jsonb, uuid, timestamptz) from public, anon;
grant execute on function public.save_warehouse_box(jsonb, uuid, timestamptz) to authenticated;

-- Re-running the script does not duplicate publication entries.
do $$
declare
  target_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach target_table in array array['boxes', 'devices', 'device_models'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
