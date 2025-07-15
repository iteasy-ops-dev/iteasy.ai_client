import type { Metadata } from 'next'
import { Inter, Noto_Sans_KR, Open_Sans, Roboto, Poppins, Nunito, Comfortaa, Quicksand, Lato, Source_Sans_3, Noto_Serif_KR, IBM_Plex_Sans_KR } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from './components/ThemeProvider'
import { FontProvider } from './components/FontProvider'

// Initialize all fonts
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const notoSansKr = Noto_Sans_KR({ 
  subsets: ['latin'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
})

const openSans = Open_Sans({ 
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
})

const roboto = Roboto({ 
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap',
})

const poppins = Poppins({ 
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})

const nunito = Nunito({ 
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

const comfortaa = Comfortaa({ 
  subsets: ['latin'],
  variable: '--font-comfortaa',
  display: 'swap',
})

const quicksand = Quicksand({ 
  subsets: ['latin'],
  variable: '--font-quicksand',
  display: 'swap',
})

const lato = Lato({ 
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-lato',
  display: 'swap',
})

const sourceSans3 = Source_Sans_3({ 
  subsets: ['latin'],
  variable: '--font-source-sans-3',
  display: 'swap',
})

const notoSerifKr = Noto_Serif_KR({ 
  subsets: ['latin'],
  variable: '--font-noto-serif-kr',
  display: 'swap',
})

const ibmPlexSansKr = IBM_Plex_Sans_KR({ 
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-sans-kr',
  display: 'swap',
})

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'system';
                  const root = document.documentElement;
                  root.classList.remove('light', 'dark');
                  
                  if (theme === 'system') {
                    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    root.classList.add(systemTheme);
                  } else {
                    root.classList.add(theme);
                  }
                } catch (e) {
                  // Fallback to system theme if localStorage is not available
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  document.documentElement.classList.add(systemTheme);
                }
              })();
            `,
          }}
        />
      </head>
      <body 
        className={`${inter.variable} ${notoSansKr.variable} ${openSans.variable} ${roboto.variable} ${poppins.variable} ${nunito.variable} ${comfortaa.variable} ${quicksand.variable} ${lato.variable} ${sourceSans3.variable} ${notoSerifKr.variable} ${ibmPlexSansKr.variable}`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <FontProvider>
            {children}
          </FontProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}