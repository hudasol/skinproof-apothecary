'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from '@/app/consult/consult.module.css';

type Status = 'queued' | 'submitting' | 'processing' | 'downloading' | 'succeeded' | 'failed' | 'interrupted';

const PHASES: { key: Status; label: string }[] = [
  { key: 'submitting', label: 'Uploading your photo securely' },
  { key: 'processing', label: 'The model is reading your skin' },
  { key: 'downloading', label: 'Collecting the results' },
];

/**
 * Follows a running job and refreshes the page when it ends. Polling stops
 * on any terminal state, on unmount, or after five minutes.
 */
export function JobProgress({ url, initial, labels = PHASES, title }: { url: string; initial: Status; labels?: { key: Status; label: string }[]; title: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    let stop = false;
    const started = Date.now();
    async function tick() {
      if (stop) return;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const body = (await res.json()) as { status: Status };
          setStatus(body.status);
          if (['succeeded', 'failed', 'interrupted'].includes(body.status)) {
            router.refresh();
            return;
          }
        } else if (res.status === 404) {
          setLost(true);
          return;
        }
      } catch {
        // A dropped request is retried on the next tick.
      }
      if (Date.now() - started < 5 * 60_000) setTimeout(tick, 1500);
      else setLost(true);
    }
    const t = setTimeout(tick, 800);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [url, router]);

  const index = labels.findIndex((p) => p.key === status);
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      <h2 style={{ fontSize: 'var(--step-2)' }}>{title}</h2>
      <ol className={styles.phases}>
        {labels.map((p, i) => (
          <li key={p.key} className={i < index ? styles.complete : i === index || (index === -1 && i === 0) ? styles.active : ''}>
            <span className={styles.phaseDot} aria-hidden="true" />
            {p.label}
          </li>
        ))}
      </ol>
      {lost && (
        <p className="small" style={{ marginTop: 'var(--space-4)' }}>
          This is taking longer than expected. <button className="btn quiet" onClick={() => router.refresh()}>Check again</button>
        </p>
      )}
    </div>
  );
}
