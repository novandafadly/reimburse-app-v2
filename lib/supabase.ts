import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Transaksi = {
  id: string
  tanggal: string
  keterangan: string
  jumlah: number
  deskripsi: string | null
  submitted_by: string | null
  submitted_at: string
  created_at: string
  lampiran?: Lampiran[]
}

export type Lampiran = {
  id: string
  transaksi_id: string
  storage_path: string
  created_at: string
}
