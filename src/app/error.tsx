'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>This page could not load</h1>
        <p>Something failed on our side. Your consultation and choices are saved; trying again usually works.</p>
      </header>
      <div className="actions">
        <button type="button" className="btn" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn secondary">
          Go to the start
        </Link>
      </div>
    </div>
  );
}
