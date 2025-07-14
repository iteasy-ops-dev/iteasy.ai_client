import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ITEasy AI Client',
  description: 'ITEasy 사내 전용 AI 채팅 클라이언트 - 업무 효율성과 생산성 향상을 위한 AI 어시스턴트',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}