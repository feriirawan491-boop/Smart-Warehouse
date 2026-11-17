-- Integration checks for a disposable/dev PostgreSQL database with Supabase auth.
-- Run schema.sql first. All test rows and auth users roll back at the end.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

do $$
begin
  if has_function_privilege('anon', 'public.save_warehouse_box(jsonb,uuid,timestamptz)', 'EXECUTE') then
    raise exception 'Anonymous users must not execute save_warehouse_box';
  end if;
  if (select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename in ('boxes', 'devices', 'device_models')) <> 3 then
    raise exception 'All three inventory tables must be published';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
declare
  first_box uuid;
  second_box uuid;
  version timestamptz;
  first_model uuid;
  draft jsonb := '{"name":"  TEST BOX  ","box_number":"00000001","model_code":"__INTEGRATION_TEST__","status":"confirmed","devices":[{"serial_number":"000000000001","mac_address":"aabbccddeeff"},{"serial_number":"000000000002","mac_address":null}]}';
begin
  insert into public.device_models (code, label) values ('__INTEGRATION_TEST__', 'Integration test') returning id into first_model;
  first_box := public.save_warehouse_box(draft);
  if (select name from public.boxes where id = first_box) <> 'TEST BOX' then raise exception 'Box name was not trimmed'; end if;
  if (select count(*) from public.devices where box_id = first_box) <> 2 then raise exception 'Create did not save both devices'; end if;
  if not exists (select 1 from public.devices where box_id = first_box and serial_number = '000000000001' and mac_address = 'AABBCCDDEEFF') then raise exception 'Leading zeros or MAC normalization lost'; end if;
  select updated_at into version from public.boxes where id = first_box;

  -- A duplicate SN must roll back the newly inserted parent box as well.
  begin
    perform public.save_warehouse_box(jsonb_set(draft, '{box_number}', '"00000002"'));
    raise exception 'Expected duplicate SN rejection';
  exception when unique_violation then null;
  end;
  if exists (select 1 from public.boxes where box_number = '00000002') then raise exception 'Failed create left an orphan box'; end if;

  -- An invalid replacement must retain every previous device and version.
  begin
    perform public.save_warehouse_box(jsonb_set(draft, '{devices}', '[{"serial_number":"123"}]'), first_box, version);
    raise exception 'Expected invalid serial rejection';
  exception when check_violation then null;
  end;
  if (select count(*) from public.devices where box_id = first_box) <> 2 then raise exception 'Failed update deleted previous devices'; end if;
  if (select updated_at from public.boxes where id = first_box) is distinct from version then raise exception 'Failed update changed version'; end if;

  -- A second operator can edit shared inventory, including adding/removing SNs.
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  perform public.save_warehouse_box(jsonb_set(draft, '{devices}', '[{"serial_number":"000000000003"}]'), first_box, version);
  if (select count(*) from public.devices where box_id = first_box) <> 1 then raise exception 'Update did not replace the device list'; end if;

  begin
    perform public.save_warehouse_box(draft, first_box, version);
    raise exception 'Expected stale version rejection' using errcode = 'XX000';
  exception when raise_exception then
    if sqlerrm not like '%tab lain%' then raise; end if;
  end;

  select updated_at into version from public.boxes where id = first_box;
  update public.devices set serial_number = '000000000004' where box_id = first_box;
  if (select updated_at from public.boxes where id = first_box) is not distinct from version then raise exception 'External device update did not invalidate editor'; end if;

  begin
    delete from public.device_models where id = first_model;
    raise exception 'Expected model in-use rejection';
  exception when foreign_key_violation then null;
  end;

  select updated_at into version from public.boxes where id = first_box;
  begin
    perform public.save_warehouse_box(jsonb_set(draft, '{devices}', '[]'), first_box, version);
    raise exception 'Expected empty-device rejection' using errcode = 'XX000';
  exception when raise_exception then
    if sqlerrm not like '%minimal satu%' then raise; end if;
  end;

  second_box := public.save_warehouse_box(jsonb_set(jsonb_set(draft, '{box_number}', '"00000002"'), '{devices}', '[{"serial_number":"000000000005"}]'));
  delete from public.boxes where id = first_box;
  if exists (select 1 from public.devices where box_id = first_box) then raise exception 'Box delete did not cascade to devices'; end if;
  delete from public.boxes where id = second_box;
  delete from public.device_models where id = first_model;
  raise notice 'PASS: atomic create/update, rollback, identifiers, shared operator edits, conflicts, external edits, model protection, cascading delete';
end;
$$;
rollback;
