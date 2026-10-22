import type { Metadata } from 'next';
import './globals.css';
import './scroll-story.css';
import VideoBackground from './video-background';
export const metadata:Metadata={title:'Developer Command Center',description:'Твоите сайтове, deployments и сигнали. Един команден център.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="bg"><body><VideoBackground/>{children}</body></html>}

