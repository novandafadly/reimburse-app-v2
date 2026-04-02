import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reimburse Makan',
  description: 'Sistem rekap reimburse makan minum kantor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: '#f3f4f6', minHeight: '100vh', fontFamily: '"DM Sans", -apple-system, sans-serif' }}>
        <style>{`
          * { box-sizing: border-box; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          input:focus, textarea:focus, select:focus { outline: none; border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.12); }
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
          }
        `}</style>
        {children}
      </body>
    </html>
  )
}
