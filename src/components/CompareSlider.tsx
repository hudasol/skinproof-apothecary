'use client';

import { useState } from 'react';
import styles from './CompareSlider.module.css';

/** Before and after on one frame, revealed with a native range input (keyboard and touch friendly). */
export function CompareSlider({ before, after, beforeLabel, afterLabel }: { before: string; after: string; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  return (
    <figure className={styles.wrap}>
      <div className={styles.stage}>
        <img src={before} alt={beforeLabel} className={styles.img} />
        <img src={after} alt={afterLabel} className={`${styles.img} ${styles.after}`} style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <span className={styles.line} style={{ left: `${pos}%` }} aria-hidden="true" />
        <span className={`${styles.tag} ${styles.tagLeft}`}>{beforeLabel}</span>
        <span className={`${styles.tag} ${styles.tagRight}`}>{afterLabel}</span>
      </div>
      <label className={styles.control}>
        <span className="visually-hidden">Move the divider between {beforeLabel} and {afterLabel}</span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} />
      </label>
    </figure>
  );
}
