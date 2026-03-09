// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import InternalChatWrapper from '@/components/internal-chat/InternalChatWrapper'

export const metadata: Metadata = {
  title: 'Psique - WhatsApp',
  description: 'Atendimento Psique - Dashboard',
  icons: {
    icon: 'https://srtyjwpmsveiyugatiqj.supabase.co/storage/v1/object/public/icon/leaves.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <InternalChatWrapper />
      </body>
    </html>
  )
}