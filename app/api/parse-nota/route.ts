import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        return { inlineData: { data: base64, mimeType: (file.type || 'image/jpeg') as string } }
      })
    )

    const prompt = `Kamu adalah asisten yang membantu mengekstrak data dari nota/struk makan minum untuk keperluan reimburse kantor.

Analisis ${files.length > 1 ? 'semua gambar berikut yang merupakan SATU transaksi yang sama' : 'gambar nota berikut'} dan ekstrak informasi berikut:

1. Tanggal transaksi (format: DD/MM/YYYY)
2. Nama tempat makan / restoran (cari di semua gambar: biasanya ada di bagian atas struk, nama merchant di app GrabFood/GoFood, atau header nota fisik)
3. Total yang dibayar (angka saja, tanpa Rp dan titik/koma pemisah ribuan)
4. Deskripsi singkat pesanan (contoh: "Nasi bebek 2 porsi, es teh 2")

${files.length > 1 ? 'PENTING: Semua gambar adalah bagian dari 1 transaksi yang sama. Cari total akhir yang benar-benar dibayar (setelah diskon, ongkir, dll). Nama toko/restoran biasanya ada di gambar pertama — pastikan dicari di SEMUA gambar.' : ''}

Jawab HANYA dalam format JSON berikut, tanpa teks lain:
{
  "tanggal": "DD/MM/YYYY",
  "keterangan": "Nama Tempat Makan",
  "jumlah": 125000,
  "deskripsi": "detail pesanan singkat",
  "confidence": "high/medium/low",
  "catatan": "opsional: catatan jika ada ambiguitas"
}`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent([prompt, ...imageParts])
    const text = result.response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Gagal membaca nota, coba foto ulang dengan lebih jelas' }, { status: 422 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, data: parsed })
  } catch (err) {
    console.error('Parse error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error: ${msg}` }, { status: 500 })
  }
}

export const maxDuration = 60
