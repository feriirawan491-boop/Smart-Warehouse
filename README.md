# Smart Warehouse

Aplikasi inventaris box dan perangkat dengan Next.js, TypeScript, Tailwind CSS, dan Supabase. Data model, box, serta perangkat disimpan di database; dashboard, riwayat, detail, pilihan model scan, dan ekspor menggunakan inventaris yang sama.

## Menyiapkan Supabase

1. Buka proyek Supabase yang sesuai dengan `NEXT_PUBLIC_SUPABASE_URL`.
2. Buka **SQL Editor**, salin **seluruh isi `supabase/schema.sql`**, lalu jalankan. Skrip dapat dijalankan ulang pada instalasi lama, mempertahankan inventaris, dan menyiapkan:
   - Tabel `device_models`, `boxes`, dan `devices`, beserta model awal.
   - Row Level Security untuk operator yang sudah login.
   - Fungsi `save_warehouse_box` untuk menyimpan box dan seluruh perangkat dalam satu transaksi.
   - Publikasi `supabase_realtime` untuk ketiga tabel.
   - Versi perubahan box untuk mencegah edit menimpa perubahan operator lain.
3. Buat akun email/password operator lewat **Authentication → Users → Add user**. Pastikan email sudah dikonfirmasi. Aplikasi memakai akun yang disediakan admin. Untuk membatasi pembuatan akun pada admin, nonaktifkan pendaftaran pengguna baru di pengaturan Auth Supabase.
4. Isi `.env.local` sesuai `.env.example`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=PUBLIC_OR_ANON_KEY
   ```

   Aplikasi menggunakan public/anon key dan sesi operator. `SUPABASE_SERVICE_ROLE_KEY` tidak diperlukan oleh aplikasi dan tidak dipakai pada browser. Semua akun operator yang login berbagi inventaris gudang yang sama.
5. Jalankan aplikasi. Untuk deployment, isi kedua environment publik tersebut di penyedia hosting dan lakukan build/deploy ulang.

**Pada instalasi lama, menjalankan SQL tetap diperlukan.** Jika muncul pesan `Database perlu diperbarui`, fungsi transaksi belum tersedia pada proyek Supabase yang sedang digunakan. Jangan hanya menyalin bagian pembuatan tabel.

## Menjalankan di lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000), lalu masuk dengan akun operator. Node.js 20.9 atau lebih baru diperlukan. Mulai ulang server setelah mengubah environment.

## Perubahan data dan realtime

- Konfirmasi scan membuat box beserta perangkat. Menambah/menghapus baris SN pada detail box baru disimpan setelah **Simpan perubahan** ditekan.
- Simpan box berjalan dalam satu transaksi database. Jika SN, MAC, atau nomor box bentrok, seluruh perubahan dibatalkan sehingga perangkat lama tetap utuh.
- **Hapus box** juga menghapus perangkat dalam box melalui foreign key cascade. **Hapus semua data** pada riwayat menghapus seluruh inventaris box/perangkat setelah konfirmasi.
- Model baru langsung tersedia pada formulir scan. Model yang dipakai box dilindungi oleh foreign key database dan tidak dapat dihapus.
- Satu subscription menerima INSERT/UPDATE/DELETE dari ketiga tabel. Halaman menghitung ulang jumlah box, jumlah perangkat, daftar, dan pratinjau ekspor dari snapshot terbaru.
- Setelah menyimpan, tersambung ulang, atau kembali ke tab, aplikasi membaca ulang inventaris. Rekonsiliasi setiap 30 detik membantu memulihkan event yang terlewat. Saat jaringan gagal, UI mempertahankan data terakhir, menampilkan pesan, dan menyediakan **Coba lagi**.
- Draft edit dipertahankan ketika perubahan eksternal masuk; pengguna diminta membatalkan edit dan memeriksa data terbaru. Database juga memeriksa versi di dalam transaksi agar perubahan yang terjadi sesaat sebelum simpan tetap terdeteksi.
- Ekspor hanya memuat box terkonfirmasi. SN, MAC, dan nomor box diperlakukan sebagai teks agar angka nol di depan tetap utuh. File `.xlsx` mengikuti template gudang; model tambahan masuk sheet terpisah. Tanggal UI memakai zona waktu Asia/Jakarta.

Untuk memeriksa aktivasi realtime, jalankan di SQL Editor:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('device_models', 'boxes', 'devices');
```

Hasil harus memuat ketiga tabel. Uji menggunakan dua tab/perangkat yang sudah login: tambah box, ubah daftar SN, lalu hapus box; jumlah dan daftar di tab lain harus berubah tanpa memuat ulang halaman.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Tes unit mencakup parsing barcode, validasi identifier, konflik edit, pagination Supabase, penyimpanan melalui RPC, dan antrean refresh. Uji integrasi SQL tersedia di `supabase/tests/inventory.sql`; jalankan pada database pengembangan dengan skema Auth Supabase setelah memasang `schema.sql`. Gunakan admin database agar pengujian dapat berpindah role. Data pengujian dibatalkan dengan `ROLLBACK`.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/inventory.sql
```

## Struktur utama

```text
src/components/auth-gate.tsx          Login dan pemulihan sesi operator
src/components/warehouse-provider.tsx Data bersama, realtime, dan rekonsiliasi
src/components/app-shell.tsx          Navigasi, status koneksi, dan keluar akun
src/lib/supabase.ts                   Pembacaan database dan operasi perubahan
src/lib/refresh-queue.ts              Antrean refresh saat perubahan beruntun
src/app/scan/new/page.tsx             Scan kamera/foto atau input manual
src/app/boxes/detail/page.tsx         Edit SN dan hapus box
src/app/devices/page.tsx              Master model
src/app/history/page.tsx              Riwayat dan filter tanggal/model
src/app/export/page.tsx               Pratinjau dan unduh Excel
supabase/schema.sql                  Instalasi dan pembaruan database
supabase/tests/inventory.sql          Uji transaksi dan aturan database
```

Pemindaian berjalan di browser menggunakan BarcodeDetector jika tersedia, dengan pembaca barcode alternatif dan input manual. Periksa hasil barcode sebelum mengonfirmasi simpan.

Referensi implementasi: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [Database functions](https://supabase.com/docs/guides/database/functions), dan [Login email/password](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

## UAT sebelum rilis

Lihat [laporan UAT 17 November 2026](docs/UAT-2026-11-17.md) untuk hasil, blocker database, cakupan simulasi, dan checklist penerimaan staging. Runner browser dapat dijalankan melalui `npm run test:uat` setelah server produksi pengujian tersedia di port 3107.
