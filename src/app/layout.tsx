import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Libre_Caslon_Display, Libre_Caslon_Text, Public_Sans } from 'next/font/google';
import { SiteNav } from '@/components/SiteNav';
import { providerState } from '@/lib/providers';
import './globals.css';
import styles from './layout.module.css';

const caslonDisplay = Libre_Caslon_Display({ subsets: ['latin'], weight: '400', variable: '--font-caslon-display', display: 'swap' });
const caslonText = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-caslon-text', display: 'swap' });
const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-public-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'SkinProof Apothecary', template: '%s · SkinProof Apothecary' },
  description: 'Understand your skin, explore botanical evidence, and find products whose reasoning you can inspect.',
};

export const viewport: Viewport = { themeColor: '#1f3a2e' };

// Pages read live consultation state; nothing is pre-rendered.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const provider = providerState();
  return (
    <html lang="en-GB" className={`${caslonDisplay.variable} ${caslonText.variable} ${publicSans.variable}`}>
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        <header className={styles.header}>
          <div className={`wrap ${styles.headerInner}`}>
            <Link href="/" className={styles.brand} aria-label="SkinProof Apothecary home">
              <svg viewBox="0 0 32 32" className={styles.brandMark} aria-hidden="true">
                <path d="M16 29 C15 21 15 13 16 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M16 18 C9 17 6 12 6 7 C12 8 15 12 16 18 Z" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="1" />
                <path d="M16 13 C22 12 25 8 26 3 C20 4 17 8 16 13 Z" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span className={styles.brandName}>SkinProof</span>
              <span className={styles.brandSub}>Apothecary</span>
            </Link>
            <SiteNav />
          </div>
        </header>
        {provider.mode === 'fixture' && (
          <div className={styles.modeBand} role="note">
            <div className="wrap">
              <strong>Demonstration data.</strong> Skin analysis and try-on use SkinProof’s offline fixture, not YouCam, so results are
              placeholders. <Link href="/system">How this works</Link>
            </div>
          </div>
        )}
        {provider.mode === 'live' && !provider.ready && (
          <div className={`${styles.modeBand} ${styles.modeBandError}`} role="note">
            <div className="wrap">
              <strong>Live mode without an API key.</strong> Skin analysis and try-on are unavailable; the library and the Ledger still work.
            </div>
          </div>
        )}
        <main id="main">{children}</main>
        <footer className={styles.footer}>
          <div className={`wrap ${styles.footerInner}`}>
            <div>
              <p className={styles.footerName}>SkinProof Apothecary</p>
              <p className="small">
                Cosmetic guidance, not medical advice. SkinProof does not diagnose skin conditions. If your skin is painful, bleeding or
                changing quickly, see a clinician.
              </p>
            </div>
            <nav aria-label="About" className={styles.footerLinks}>
              <Link href="/ledger">How decisions are made</Link>
              <Link href="/privacy">Your data</Link>
              <Link href="/system">Integration status</Link>
            </nav>
            <p className="small">
              Skin analysis and virtual try-on by the YouCam API from Perfect Corp. Product data was checked against brand and retailer pages
              on 18 October 2026; brands change formulas, so check the label before you buy.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
