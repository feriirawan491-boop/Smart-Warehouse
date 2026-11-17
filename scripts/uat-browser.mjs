import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
const outputDir = path.join(os.tmpdir(), 'smart-warehouse-uat');
fs.mkdirSync(outputDir, {recursive:true});
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  let boxes = [];
  const models = [{ id: 'model-1', code: 'ROUTER OUTDOOR T3000', label: 'Router Outdoor T3000' }, { id: 'model-2', code: 'MF296A2', label: 'MF296A2' }];
  let saves = 0;
  let failRead = false;
  const channels = [];
  function broadcast(table, type = 'UPDATE') {
    for (const channel of channels) channel.send([channel.joinRef, null, channel.topic, 'postgres_changes', { ids: [table === 'boxes' ? 1 : table === 'devices' ? 2 : 3], data: { schema: 'public', table, type, commit_timestamp: new Date().toISOString(), columns: [], record: {}, old_record: {}, errors: null } }]);
  }
  await page.routeWebSocket('**/realtime/v1/websocket*', ws => {
    const channel = { topic: '', joinRef: '', send: msg => ws.send(JSON.stringify(msg)) };
    channels.push(channel);
    ws.onMessage(raw => {
      const message = JSON.parse(raw.toString());
      const [joinRef, ref, topic, event, payload] = message;
      if (event === 'phx_join') {
        channel.topic = topic; channel.joinRef = joinRef;
        channel.send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: payload.config.postgres_changes.map((binding, index) => ({ ...binding, id: index + 1 })) } }]);
      } else if (event === 'heartbeat' || event === 'phx_leave') channel.send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]);
    });
  });
  await context.route('https://*.supabase.co/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const body = method === 'POST' || method === 'PATCH' ? req.postDataJSON() : null;
    let data = []; let status = 200;
    if (url.pathname === '/auth/v1/token') {
      if (body.password === 'wrong') { status = 400; data = { code: 'invalid_credentials', error_code:'invalid_credentials', msg: 'Invalid login credentials' }; }
      else {
        const id = '11111111-1111-4111-8111-111111111111';
        const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')+'.'+Buffer.from(JSON.stringify({ sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600 })).toString('base64url')+'.fake';
        data = { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'qa-refresh', user: { id, aud: 'authenticated', role: 'authenticated', email: 'operator@example.test', app_metadata: { provider: 'email' }, user_metadata: { name: 'QA Operator' }, identities: [], created_at: new Date().toISOString() } };
      }
    } else if (url.pathname === '/auth/v1/logout') data = {};
    else if (url.pathname === '/rest/v1/boxes') {
      if (method === 'GET') {
        if (failRead) { status = 503; data = { message: 'QA database unavailable' }; }
        else data = boxes;
      } else if (method === 'DELETE') {
        const filter = url.searchParams.get('id');
        const removed = filter?.startsWith('eq.') ? boxes.filter(b => b.id === filter.slice(3)) : boxes;
        boxes = boxes.filter(b => !removed.includes(b));
        data = req.headers().accept?.includes('object') ? { id: removed[0]?.id } : removed.map(b => ({ id:b.id }));
      }
    } else if (url.pathname === '/rest/v1/device_models') {
      if (method === 'POST') { const row = { id:randomUUID(), ...body }; models.push(row); data = null; status = 201; }
      else if (method === 'DELETE') { const i = models.findIndex(m => m.code === url.searchParams.get('code').slice(3)); data = { id: models[i].id }; models.splice(i,1); }
      else data = models;
    } else if (url.pathname === '/rest/v1/rpc/save_warehouse_box') {
      saves++;
      const p = body.payload; const previous = boxes.find(b => b.id === body.target_box_id);
      if (previous && previous.updated_at !== body.expected_updated_at) { status = 400; data = { code: 'P0001', message: 'Data box telah berubah di tab lain.' }; }
      else {
        const box = { id: body.target_box_id || randomUUID(), name:p.name, box_number:p.box_number, status:p.status, scanned_at:previous?.scanned_at || new Date().toISOString(), updated_at:new Date().toISOString(), model: { code:p.model_code, label:p.model_code }, devices:p.devices.map((d,i) => ({id:randomUUID(),unit_sequence:i+1,...d})) };
        boxes = [box, ...boxes.filter(b => b.id !== box.id)]; data = box.id;
        await new Promise(resolve => setTimeout(resolve,150));
      }
    } else throw new Error('Unmocked API path: '+url.pathname);
    await route.fulfill({ status, contentType:'application/json', body:JSON.stringify(data) });
  });
  try {
    await page.goto(process.env.UAT_BASE_URL || 'http://127.0.0.1:3107');
    await page.getByLabel('Email operator').fill('operator@example.test');
    await page.getByLabel('Kata sandi').fill('wrong');
    await page.getByRole('button', { name:'Masuk', exact:true }).click();
    await page.getByRole('alert').filter({hasText:'Email atau kata sandi salah.'}).waitFor();
    await page.getByLabel('Kata sandi').fill('qa-password');
    await page.getByRole('button', { name:'Masuk', exact:true }).click();
    await page.getByText('Realtime aktif', {exact:true}).waitFor();
    await page.getByRole('button', {name:'Data Device',exact:true}).click();
    await page.getByPlaceholder('Contoh: Router Outdoor T3000').fill('QA Router');
    await page.getByRole('button', {name:'Tambah model',exact:true}).click();
    await page.getByText('QA Router ditambahkan ke pilihan scan.').waitFor();
    models.push({id:randomUUID(),code:'EXTERNAL ROUTER',label:'External Router'});
    broadcast('device_models','INSERT');
    await page.getByRole('button',{name:'Hapus External Router',exact:true}).waitFor();
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Hapus External Router',exact:true}).click();
    await page.getByText('External Router dihapus.',{exact:true}).waitFor();
    await page.getByRole('button', {name:'Scan label baru',exact:true}).click();
    await page.getByRole('button', {name:'Ubah detail',exact:true}).click();
    await page.getByPlaceholder('Contoh: BOX 1').fill('QA BOX');
    await page.locator('select').selectOption('QA ROUTER');
    await page.getByRole('button', {name:'Input manual',exact:true}).click();
    await page.getByLabel('Nomor box tahap pertama').fill('00000001');
    await page.getByRole('button', {name:/Konfirmasi Box No/}).click();
    await page.getByRole('button', {name:'Input manual',exact:true}).click();
    await page.getByLabel('Serial perangkat 1').fill('000000000001');
    await page.getByRole('button', {name:'Tambah baris',exact:true}).click();
    await page.getByLabel('Serial perangkat 2').fill('000000000002');
    await page.getByRole('button', {name:'Konfirmasi & simpan',exact:true}).click();
    await page.getByText('Inventaris sudah diperbarui.',{exact:true}).waitFor();
    assert.equal(saves,1);
    assert.equal(boxes[0].devices.length,2);
    await page.getByRole('button',{name:'Ringkasan',exact:true}).click();
    await page.getByRole('link',{name:'Lihat SN box 00000001'}).waitFor();
    assert.match(await page.locator('.stat-card').nth(1).innerText(),/02/);
    const savedBox=boxes[0];
    boxes.push({...savedBox,id:randomUUID(),name:'EXTERNAL BOX',box_number:'00000009',devices:[{id:randomUUID(),unit_sequence:1,serial_number:'000000000009',mac_address:null}]});
    broadcast('boxes','INSERT');
    await page.waitForFunction(() => document.querySelectorAll('.stat-card')[0]?.innerText.includes('02'));
    boxes=[savedBox];broadcast('boxes','DELETE');
    await page.waitForFunction(() => document.querySelectorAll('.stat-card')[0]?.innerText.includes('01'));
    // Simulate an external device insertion and its websocket message.
    boxes[0].devices.push({id:randomUUID(),unit_sequence:3,serial_number:'000000000003',mac_address:null});
    boxes[0].updated_at = new Date().toISOString();
    broadcast('devices','INSERT');
    await page.waitForFunction(() => document.querySelectorAll('.stat-card')[1]?.innerText.includes('03'));
    await page.getByRole('link',{name:'Lihat SN box 00000001'}).click();
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    await page.getByRole('button',{name:'Hapus SN baris 3',exact:true}).click();
    await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
    await page.getByText('Perubahan berhasil disimpan ke Supabase.',{exact:true}).waitFor();
    assert.equal(boxes[0].devices.length,2);
    await page.getByRole('button',{name:'Edit',exact:true}).click();
    boxes[0].updated_at = new Date(Date.now()+1000).toISOString();
    broadcast('boxes');
    await page.getByText('Data box berubah di perangkat lain.',{exact:false}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Simpan perubahan',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Batal',exact:true}).click();
    await page.getByRole('button',{name:'Ekspor data',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Unduh Excel',exact:true}).isEnabled(),true);
    // Reconciliation failure must preserve the last inventory and recover.
    failRead = true; broadcast('boxes');
    await page.getByRole('alert').filter({hasText:'QA database unavailable'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Unduh Excel',exact:true}).isDisabled(),true);
    failRead = false;
    await page.getByRole('button',{name:'Coba lagi',exact:true}).click();
    await page.waitForFunction(() => !document.querySelector('.sync-error'));
    await page.getByRole('button',{name:'Riwayat scan',exact:true}).click();
    await page.getByRole('link',{name:'Lihat SN box 00000001'}).click();
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Hapus box',exact:true}).click();
    await page.waitForURL('**/history');
    assert.equal(boxes.length,0);
    await page.getByRole('button',{name:'Keluar dari akun',exact:true}).click();
    await page.getByRole('heading',{name:'Masuk ke gudang',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(outputDir,'login-mobile.png')});
    console.log('PASS: login errors, login, model create/delete, scan create, live box insert/delete and device counts via websocket, edit/remove SN, edit conflict, export, read failure/recovery, box delete, logout; no browser errors.');
  } catch(e) { console.log((await page.locator('body').innerText()).slice(0,2000)); await page.screenshot({path:path.join(outputDir,'failure.png')}); throw e; } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
