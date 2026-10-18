'use client';

import { useState } from 'react';
import styles from './MaskViewer.module.css';

/**
 * The photo with one YouCam detection mask laid over it at a time. Masks are
 * the provider's own output (PNG with transparency), shown as returned.
 */
export function MaskViewer({ photoUrl, masks }: { photoUrl: string; masks: { concern: string; label: string; url: string }[] }) {
  const [active, setActive] = useState<string | null>(masks[0]?.concern ?? null);
  const current = masks.find((m) => m.concern === active);
  return (
    <figure className={styles.viewer}>
      <div className={styles.stage}>
        <img src={photoUrl} alt="Your photo" />
        {current && <img src={current.url} alt={`Where the model detected ${current.label.toLowerCase()}`} className={styles.mask} />}
      </div>
      <figcaption>
        <div className={styles.toggles} role="group" aria-label="Show a detection mask">
          {masks.map((m) => (
            <button key={m.concern} type="button" aria-pressed={active === m.concern} onClick={() => setActive(active === m.concern ? null : m.concern)}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="small">Masks show where YouCam’s model looked for each concern, as it returned them. Photo and masks are deleted after a day.</p>
      </figcaption>
    </figure>
  );
}
