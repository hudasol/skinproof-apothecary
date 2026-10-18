'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { uploadPhotoAction } from '@/app/actions';
import { initialState } from '@/app/action-state';
import { FieldError, FormMessage, SubmitButton } from './bits';
import styles from './PhotoForm.module.css';

type Crop = { x: number; y: number; width: number; height: number };
const FULL: Crop = { x: 0, y: 0, width: 1, height: 1 };
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024 - 1;
const MIN_SHORT_SIDE = 480;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Photo upload with an optional crop. The crop is sent as fractions and
 * re-validated on the server; the browser checks only give earlier feedback.
 */
export function PhotoForm({ next, submitLabel, returnTo }: { next: 'analysis' | 'colour'; submitLabel: string; returnTo?: string }) {
  const [state, action] = useActionState(uploadPhotoAction, initialState);
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Crop>(FULL);
  const [clientError, setClientError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; start: Crop } | null>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null);
    const f = e.target.files?.[0];
    setSize(null);
    setCrop(FULL);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setClientError('Use a JPEG, PNG or WebP photo.');
    if (f.size > MAX_BYTES) return setClientError('Photos must be under 10 MB.');
    setUrl(URL.createObjectURL(f));
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    if (d.mode === 'move') {
      setCrop({ ...d.start, x: clamp(d.start.x + dx, 0, 1 - d.start.width), y: clamp(d.start.y + dy, 0, 1 - d.start.height) });
    } else {
      setCrop({ ...d.start, width: clamp(d.start.width + dx, 0.1, 1 - d.start.x), height: clamp(d.start.height + dy, 0.1, 1 - d.start.y) });
    }
  }, []);

  const endDrag = useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onPointerMove]);

  function startDrag(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  }

  function onKey(e: React.KeyboardEvent) {
    const step = 0.02;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    setCrop((c) =>
      e.shiftKey
        ? { ...c, width: clamp(c.width + m[0], 0.1, 1 - c.x), height: clamp(c.height + m[1], 0.1, 1 - c.y) }
        : { ...c, x: clamp(c.x + m[0], 0, 1 - c.width), y: clamp(c.y + m[1], 0, 1 - c.height) },
    );
  }

  const px = size ? { w: Math.round(crop.width * size.w), h: Math.round(crop.height * size.h) } : null;
  const tooSmall = px ? Math.min(px.w, px.h) < MIN_SHORT_SIDE : false;
  const cropped = crop.x !== 0 || crop.y !== 0 || crop.width !== 1 || crop.height !== 1;

  return (
    <form action={action} className={styles.form}>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <input type="hidden" name="crop" value={cropped ? JSON.stringify(crop) : ''} />
      <div className="field">
        <label htmlFor="photo">Your photo</label>
        <input id="photo" name="photo" type="file" accept={ACCEPT.join(',')} onChange={onFile} className="input" aria-describedby="photo-hint" />
        <span className="hint" id="photo-hint">
          JPEG, PNG or WebP under 10 MB, at least 480 pixels on the shorter side.
        </span>
        <FieldError message={clientError ?? state.fieldErrors?.photo} />
      </div>

      {url && (
        <div className={styles.cropArea}>
          <div className={styles.frame} ref={frame}>
            <img src={url} alt="Your photo, before upload" onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} draggable={false} />
            <div
              className={`${styles.box} ${tooSmall ? styles.boxWarn : ''}`}
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
              role="slider"
              tabIndex={0}
              aria-label="Crop area. Arrow keys move it; Shift and arrow keys resize it."
              aria-valuetext={px ? `${px.w} by ${px.h} pixels` : undefined}
              onKeyDown={onKey}
              onPointerDown={(e) => startDrag('move', e)}
            >
              <span className={styles.oval} aria-hidden="true" />
              <span className={styles.handle} onPointerDown={(e) => startDrag('resize', e)} aria-hidden="true" />
            </div>
          </div>
          <div className={styles.cropInfo}>
            <p className="small">
              Drag the frame so your face fills most of its width, then drag the corner to resize. The analysis needs your face to be wider
              than 60% of the photo.
            </p>
            {px && (
              <p className={`small ${tooSmall ? 'field-error' : ''}`}>
                Selected area: {px.w} × {px.h} pixels{tooSmall ? `. Too small: the shorter side must be at least ${MIN_SHORT_SIDE}.` : '.'}
              </p>
            )}
            <button type="button" className="btn quiet" onClick={() => setCrop(FULL)} disabled={!cropped}>
              Use the whole photo
            </button>
          </div>
        </div>
      )}

      <div className="actions">
        <SubmitButton pending={next === 'analysis' ? 'Uploading and starting analysis…' : 'Uploading…'} disabled={!url || !!clientError || tooSmall}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
