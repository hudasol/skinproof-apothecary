'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './SiteNav.module.css';

const LINKS = [
  { href: '/consult', label: 'Consultation' },
  { href: '/shortlist', label: 'Your shortlist' },
  { href: '/products', label: 'Apothecary' },
  { href: '/library', label: 'Botanical library' },
  { href: '/colour', label: 'Lip colour' },
  { href: '/ledger', label: 'The Ledger' },
];

export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <nav aria-label="Main" className={styles.nav}>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>
        Menu
      </button>
      <ul id="main-nav" className={`${styles.list} ${open ? styles.open : ''}`}>
        {LINKS.map((l) => {
          const active = path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={active ? 'page' : undefined} className={styles.link}>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
