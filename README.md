# Smart Warehouse

Preview aplikasi pencatatan label box dan inventaris router. Dibuat dengan Next.js, TypeScript, Tailwind CSS v4, Radix UI primitives, dan Lucide icons.

## Menjalankan di lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Node.js 20.9 atau lebih baru diperlukan.

## Perintah proyek

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit
```

## Struktur

```text
src/
├── app/
│   ├── export/page.tsx       # Pratinjau dan unduh Excel sesuai template
│   ├── devices/page.tsx      # Master model device untuk dropdown scan
│   ├── history/page.tsx      # Riwayat scan
│   ├── scan/new/page.tsx     # Alur input, unggah foto, review
│   ├── globals.css           # Satu design system dan seluruh styling
│   ├── layout.tsx
│   └── page.tsx              # Dashboard
├── components/
│   └── app-shell.tsx         # Sidebar, navigasi, dan header
└── lib/
    ├── data.ts               # Tipe domain dan data demo
    └── excel.ts              # Pembentuk workbook .xlsx tanpa dependensi tambahan
```

### Batas preview

Scan barcode menggunakan `BarcodeDetector` bawaan browser Chromium yang mendukungnya; arahkan kamera ke barcode lalu periksa hasil MAC, SN, dan nomor box sebelum menyimpan. Browser yang belum mendukung deteksi barcode masih dapat melanjutkan dengan foto dan input manual. Data box dan master model device tersimpan di `localStorage` browser. Halaman ekspor membuat file `.xlsx` berformat tiga kolom sesuai workbook referensi; model tambahan diekspor di sheet terpisah. OCR teks penuh, akun, dan database belum terhubung. Data awal hanya fixture demonstrasi, bukan stok gudang aktual.
