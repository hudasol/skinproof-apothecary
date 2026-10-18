import type { ReactNode } from 'react';

/**
 * Original line drawings of the catalogue's twelve plants, in the manner of a
 * herbarium plate. They are built from a few generators (leaves, petals,
 * stems) so the set shares one consistent pen. Decorative: the accessible
 * name is the plant's name, passed by the caller.
 */

const INK = 'var(--green-800)';
const WASH = 'var(--sage-200)';

type P = { x: number; y: number };

/** A leaf from base (0,0) along +y negative (upwards), length l, half-width w. */
function leafPath(l: number, w: number, tip = 0.62): string {
  return `M0,0 C${w},${-l * 0.18} ${w * 1.05},${-l * tip} 0,${-l} C${-w * 1.05},${-l * tip} ${-w},${-l * 0.18} 0,0 Z`;
}

/** A round, kidney-shaped leaf (Centella). */
function renifromPath(r: number): string {
  return `M0,0 C${r * 0.35},${-r * 0.1} ${r * 1.1},${-r * 0.2} ${r * 1.05},${-r * 0.95} C${r},${-r * 1.75} ${-r},${-r * 1.75} ${-r * 1.05},${-r * 0.95} C${-r * 1.1},${-r * 0.2} ${-r * 0.35},${-r * 0.1} 0,0 Z`;
}

function Leaf({ at, angle, l, w, vein = true, fill = true, tip }: { at: P; angle: number; l: number; w: number; vein?: boolean; fill?: boolean; tip?: number }) {
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${angle})`}>
      <path d={leafPath(l, w, tip)} fill={fill ? WASH : 'none'} fillOpacity={0.55} stroke={INK} strokeWidth={1.1} />
      {vein && <path d={`M0,0 Q${w * 0.08},${-l * 0.5} 0,${-l * 0.92}`} fill="none" stroke={INK} strokeWidth={0.7} />}
      {vein &&
        [0.3, 0.5, 0.7].map((t) => (
          <g key={t}>
            <path d={`M0,${-l * t} Q${w * 0.45},${-l * (t + 0.06)} ${w * 0.7},${-l * (t + 0.14)}`} fill="none" stroke={INK} strokeWidth={0.45} />
            <path d={`M0,${-l * t} Q${-w * 0.45},${-l * (t + 0.06)} ${-w * 0.7},${-l * (t + 0.14)}`} fill="none" stroke={INK} strokeWidth={0.45} />
          </g>
        ))}
    </g>
  );
}

function Flower({ at, petals, r, petalW, centre, fill = 'var(--paper-raised)', centreFill = 'var(--amber-100)' }: { at: P; petals: number; r: number; petalW: number; centre: number; fill?: string; centreFill?: string }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      {Array.from({ length: petals }, (_, i) => (
        <path key={i} transform={`rotate(${(360 / petals) * i})`} d={leafPath(r, petalW, 0.7)} fill={fill} stroke={INK} strokeWidth={0.8} />
      ))}
      <circle r={centre} fill={centreFill} stroke={INK} strokeWidth={0.9} />
      {centre > 4 && Array.from({ length: 7 }, (_, i) => <circle key={i} cx={Math.cos(i) * centre * 0.5} cy={Math.sin(i * 1.7) * centre * 0.5} r={0.7} fill={INK} />)}
    </g>
  );
}

function Stem({ d, w = 1.2 }: { d: string; w?: number }) {
  return <path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" />;
}

function Pinnate({ at, angle, pairs, l, w, step, terminal = true }: { at: P; angle: number; pairs: number; l: number; w: number; step: number; terminal?: boolean }) {
  const len = step * pairs + 6;
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${angle})`}>
      <Stem d={`M0,0 L0,${-len}`} w={0.8} />
      {Array.from({ length: pairs }, (_, i) => (
        <g key={i}>
          <Leaf at={{ x: 0, y: -(i + 1) * step }} angle={62} l={l} w={w} vein={false} />
          <Leaf at={{ x: 0, y: -(i + 1) * step }} angle={-62} l={l} w={w} vein={false} />
        </g>
      ))}
      {terminal && <Leaf at={{ x: 0, y: -len }} angle={0} l={l} w={w} vein={false} />}
    </g>
  );
}

const plates: Record<string, () => ReactNode> = {
  centella: () => (
    <>
      <Stem d="M14,226 C60,220 120,232 188,222" w={1.4} />
      {[40, 92, 150].map((x) => (
        <Stem key={x} d={`M${x},${226} l-6,14 M${x},226 l4,13 M${x},226 l-1,16`} w={0.6} />
      ))}
      {[
        { x: 46, top: 96, lean: 4, r: 24 },
        { x: 92, top: 58, lean: 6, r: 32 },
        { x: 120, top: 128, lean: 20, r: 22 },
        { x: 150, top: 82, lean: 12, r: 28 },
      ].map((l, i) => (
        <g key={i}>
          <Stem d={`M${l.x},226 Q${l.x + l.lean * 0.3},${(226 + l.top) / 2} ${l.x + l.lean},${l.top}`} w={0.9} />
          <g transform={`translate(${l.x + l.lean} ${l.top})`}>
            <path d={renifromPath(l.r)} fill={WASH} fillOpacity={0.55} stroke={INK} strokeWidth={1.1} />
            {[-50, -20, 10, 40].map((a) => (
              <path key={a} d={`M0,0 L${Math.sin((a * Math.PI) / 180) * l.r * 0.95},${-Math.cos((a * Math.PI) / 180) * l.r * 1.15}`} stroke={INK} strokeWidth={0.45} />
            ))}
          </g>
        </g>
      ))}
    </>
  ),
  oat: () => (
    <>
      <Stem d="M100,240 C98,180 104,120 98,40" w={1.2} />
      <Stem d="M100,240 C92,190 74,150 52,96" w={1} />
      <path d="M100,236 C130,190 150,170 176,150" fill="none" stroke={INK} strokeWidth={0.9} />
      <path d="M100,236 C126,192 146,174 176,150" fill={WASH} fillOpacity={0.4} stroke="none" />
      {[
        [98, 40],
        [104, 70],
        [92, 92],
        [110, 108],
        [60, 104],
        [72, 128],
        [88, 132],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i % 2 ? 24 : -20})`}>
          <Stem d="M0,0 L0,16" w={0.6} />
          <path d={leafPath(22, 5)} transform="translate(0 38) rotate(180)" fill={WASH} fillOpacity={0.6} stroke={INK} strokeWidth={0.9} />
          <path d={leafPath(18, 4)} transform="translate(3 36) rotate(172)" fill="none" stroke={INK} strokeWidth={0.6} />
        </g>
      ))}
    </>
  ),
  licorice: () => (
    <>
      <path d="M86,214 C96,224 90,236 104,246 C112,252 108,256 120,258" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M92,226 C80,234 74,238 62,244" fill="none" stroke={INK} strokeWidth={1.6} />
      <Stem d="M86,214 C90,160 98,100 104,24" w={1.4} />
      <Pinnate at={{ x: 92, y: 168 }} angle={-48} pairs={4} l={18} w={6} step={13} />
      <Pinnate at={{ x: 98, y: 116 }} angle={44} pairs={4} l={17} w={6} step={12} />
      <Pinnate at={{ x: 101, y: 72 }} angle={-40} pairs={3} l={15} w={5} step={11} />
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx={104 + (i % 2 ? 4 : -4)} cy={30 + i * 8} rx={4} ry={6} fill="var(--sage-300)" stroke={INK} strokeWidth={0.7} />
      ))}
    </>
  ),
  'green-tea': () => (
    <>
      <Stem d="M40,244 C70,200 100,150 150,40" w={2} />
      {[
        { at: { x: 64, y: 206 }, a: -70, l: 62 },
        { at: { x: 86, y: 170 }, a: 52, l: 58 },
        { at: { x: 104, y: 136 }, a: -62, l: 54 },
        { at: { x: 122, y: 100 }, a: 46, l: 46 },
        { at: { x: 138, y: 66 }, a: -40, l: 36 },
      ].map((l, i) => (
        <Leaf key={i} at={l.at} angle={l.a} l={l.l} w={l.l * 0.3} />
      ))}
      <Flower at={{ x: 150, y: 150 }} petals={6} r={16} petalW={10} centre={7} />
      <Stem d="M118,112 Q136,128 146,140" w={0.8} />
    </>
  ),
  bakuchiol: () => (
    <>
      <Stem d="M100,250 C102,190 96,130 100,60" w={1.4} />
      {[
        { at: { x: 100, y: 210 }, a: -58, l: 56 },
        { at: { x: 100, y: 180 }, a: 54, l: 60 },
        { at: { x: 99, y: 140 }, a: -50, l: 54 },
        { at: { x: 99, y: 108 }, a: 48, l: 48 },
      ].map((l, i) => (
        <Leaf key={i} at={l.at} angle={l.a} l={l.l} w={l.l * 0.42} tip={0.5} />
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <ellipse key={i} cx={100 + Math.cos(i * 2.4) * (8 + (i % 4) * 4)} cy={52 - i * 2.4 + Math.sin(i) * 3} rx={3.2} ry={4.2} fill="var(--green-700)" fillOpacity={0.35} stroke={INK} strokeWidth={0.6} />
      ))}
    </>
  ),
  soy: () => (
    <>
      <Stem d="M96,250 C92,200 108,150 100,40" w={1.5} />
      {[
        { at: { x: 96, y: 196 }, a: -40 },
        { at: { x: 101, y: 140 }, a: 36 },
        { at: { x: 100, y: 84 }, a: -28 },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.at.x} ${t.at.y}) rotate(${t.a})`}>
          <Stem d="M0,0 L0,-22" w={0.8} />
          <Leaf at={{ x: 0, y: -22 }} angle={0} l={42} w={15} />
          <Leaf at={{ x: 0, y: -22 }} angle={-70} l={34} w={13} />
          <Leaf at={{ x: 0, y: -22 }} angle={70} l={34} w={13} />
        </g>
      ))}
      {[
        { x: 104, y: 214, a: 32 },
        { x: 92, y: 168, a: -36 },
      ].map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.a})`}>
          <path d="M0,0 C8,8 6,22 14,30 C20,38 18,50 26,54 C18,58 10,48 6,40 C-2,30 2,18 -4,8 Z" fill={WASH} stroke={INK} strokeWidth={0.9} />
          {[10, 22, 36].map((y) => (
            <circle key={y} cx={y / 4 + 2} cy={y + 4} r={3} fill="none" stroke={INK} strokeWidth={0.5} />
          ))}
        </g>
      ))}
    </>
  ),
  'tea-tree': () => (
    <>
      <Stem d="M100,250 C98,200 92,150 96,30" w={1.6} />
      <Stem d="M97,170 C120,140 140,110 160,60" w={1.1} />
      <Stem d="M95,130 C76,104 60,84 44,50" w={1.1} />
      {Array.from({ length: 30 }, (_, i) => {
        const branch = i % 3;
        const t = Math.floor(i / 3) / 10;
        const pts = [
          { x: 98 - t * 4, y: 240 - t * 200 },
          { x: 102 + t * 56, y: 166 - t * 104 },
          { x: 93 - t * 48, y: 126 - t * 74 },
        ][branch]!;
        return <Leaf key={i} at={pts} angle={(i % 2 ? 1 : -1) * (36 + (i % 5) * 6) + (branch === 1 ? 28 : branch === 2 ? -28 : 0)} l={20} w={2.2} vein={false} />;
      })}
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={96 + Math.sin(i * 1.3) * 6} cy={34 + i * 3.4} r={2.6} fill="var(--paper-raised)" stroke={INK} strokeWidth={0.5} />
      ))}
    </>
  ),
  aloe: () => (
    <>
      <Stem d="M104,180 C106,130 110,80 112,26" w={1.2} />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} transform={`translate(${112 + (i % 2 ? 4 : -4)} ${30 + i * 7}) rotate(${i % 2 ? 160 : 200})`}>
          <path d={leafPath(12, 2.6)} fill="var(--amber-100)" stroke={INK} strokeWidth={0.7} />
        </g>
      ))}
      {[-62, -38, -14, 12, 36, 60].map((a) => (
        <g key={a} transform={`translate(100 236) rotate(${a})`}>
          <path d={leafPath(96 - Math.abs(a) * 0.5, 13, 0.4)} fill={WASH} fillOpacity={0.7} stroke={INK} strokeWidth={1.1} />
          <path d={`M0,-6 Q2,${-40} 0,${-(80 - Math.abs(a) * 0.5)}`} fill="none" stroke={INK} strokeWidth={0.45} />
        </g>
      ))}
    </>
  ),
  'witch-hazel': () => (
    <>
      <Stem d="M30,236 C70,200 110,150 176,70" w={2.2} />
      <Stem d="M92,168 C80,130 74,100 60,64" w={1.2} />
      {[
        { at: { x: 60, y: 210 }, a: 30, l: 60 },
        { at: { x: 118, y: 140 }, a: -24, l: 58 },
        { at: { x: 150, y: 104 }, a: 40, l: 46 },
      ].map((l, i) => (
        <Leaf key={i} at={l.at} angle={l.a} l={l.l} w={l.l * 0.48} tip={0.55} />
      ))}
      {[
        { x: 62, y: 66 },
        { x: 78, y: 112 },
        { x: 172, y: 70 },
      ].map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y})`}>
          {[0, 1, 2, 3].map((k) => (
            <path key={k} transform={`rotate(${k * 90 + 20})`} d="M0,0 C4,-6 -3,-12 2,-18 C5,-22 0,-25 2,-28" fill="none" stroke="var(--amber-600)" strokeWidth={1.6} strokeLinecap="round" />
          ))}
          <circle r={2.4} fill={INK} />
        </g>
      ))}
    </>
  ),
  calendula: () => (
    <>
      <Stem d="M100,252 C96,200 104,140 100,92" w={1.6} />
      <Leaf at={{ x: 99, y: 214 }} angle={-56} l={64} w={13} tip={0.55} />
      <Leaf at={{ x: 101, y: 176 }} angle={52} l={58} w={12} tip={0.55} />
      <Leaf at={{ x: 100, y: 138 }} angle={-44} l={44} w={10} tip={0.55} />
      <Flower at={{ x: 100, y: 68 }} petals={22} r={40} petalW={5.4} centre={14} fill="var(--amber-100)" centreFill="var(--amber-600)" />
    </>
  ),
  feverfew: () => (
    <>
      <Stem d="M100,252 C98,200 100,150 100,110" w={1.4} />
      <Stem d="M100,150 C80,120 66,90 56,66" w={1} />
      <Stem d="M100,140 C120,112 136,92 148,62" w={1} />
      <Stem d="M100,112 L100,52" w={1} />
      {[
        { at: { x: 100, y: 222 }, a: -60 },
        { at: { x: 100, y: 190 }, a: 58 },
      ].map((l, i) => (
        <g key={i} transform={`translate(${l.at.x} ${l.at.y}) rotate(${l.a})`}>
          <Stem d="M0,0 L0,-52" w={0.8} />
          {[14, 26, 38].map((y) => (
            <g key={y}>
              <Leaf at={{ x: 0, y: -y }} angle={56} l={16} w={6} vein={false} tip={0.45} />
              <Leaf at={{ x: 0, y: -y }} angle={-56} l={16} w={6} vein={false} tip={0.45} />
            </g>
          ))}
          <Leaf at={{ x: 0, y: -52 }} angle={0} l={14} w={6} vein={false} />
        </g>
      ))}
      {[
        { x: 56, y: 60 },
        { x: 100, y: 46 },
        { x: 148, y: 56 },
        { x: 78, y: 92 },
        { x: 126, y: 86 },
      ].map((f, i) => (
        <Flower key={i} at={f} petals={13} r={12} petalW={3.6} centre={6} centreFill="var(--amber-600)" />
      ))}
    </>
  ),
  rosehip: () => (
    <>
      <Stem d="M40,248 C70,190 110,130 170,96" w={2} />
      <Pinnate at={{ x: 78, y: 196 }} angle={-30} pairs={2} l={20} w={9} step={16} />
      <Pinnate at={{ x: 120, y: 142 }} angle={38} pairs={2} l={18} w={8} step={14} />
      {[
        { x: 162, y: 128, a: 20 },
        { x: 142, y: 160, a: -10 },
      ].map((h, i) => (
        <g key={i} transform={`translate(${h.x} ${h.y}) rotate(${h.a})`}>
          <Stem d="M0,-26 L0,-12" w={0.8} />
          <ellipse cx={0} cy={0} rx={11} ry={15} fill="var(--madder-100)" stroke={INK} strokeWidth={1} />
          <path d="M-5,13 L-9,24 M0,15 L0,26 M5,13 L9,24" stroke={INK} strokeWidth={0.8} />
          <path d="M-4,-6 Q0,-11 4,-6" fill="none" stroke={INK} strokeWidth={0.5} />
        </g>
      ))}
    </>
  ),
};

export function BotanicalPlate({ id, title, className }: { id: string; title: string; className?: string }) {
  const draw = plates[id];
  return (
    <svg viewBox="0 0 200 260" role="img" aria-label={title} className={className} preserveAspectRatio="xMidYMid meet">
      {draw ? draw() : <circle cx={100} cy={130} r={40} fill={WASH} stroke={INK} />}
    </svg>
  );
}

export const PLATE_IDS = Object.keys(plates);
