# Reimburse Makan v2 🧾

Sistem rekap reimburse makan minum kantor dengan auth, upload nota, rekap + edit, dan export PDF.

## Stack
- **Frontend + API**: Next.js 14
- **Database + Storage + Auth**: Supabase
- **AI Parser**: Gemini 2.0 Flash (gratis)
- **Deploy**: Vercel

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://ggzdxyqxexukipgtslqt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
GEMINI_API_KEY=<gemini api key>
GOOGLE_SCRIPT_URL=<optional, untuk sync ke Google Sheet>
```

## Fitur
- Login / Register dengan email
- Upload foto nota (multi-file per transaksi, AI parse otomatis)
- Foto tersimpan di Supabase Storage
- Halaman Rekap: filter periode, edit, hapus
- Export PDF: tabel rekap + lampiran foto (Ctrl+P / tombol Export)

## Deploy ke Vercel
1. Push ke GitHub
2. Import repo di vercel.com
3. Set environment variables di Vercel Dashboard
4. Deploy

## Menambah User
Buka `/login` → tab Daftar → masukkan email & password.
Atau tambah langsung di Supabase Dashboard → Authentication → Users.
