import Link from 'next/link';
import { SpecimenSheet } from '@/components/SpecimenSheet';
import { getBotanical, getCatalogue, getProduct } from '@/lib/catalogue';
import { botanicalCounts, catalogueFacts } from '@/lib/catalogue/facts';
import { STAGES } from '@/lib/view';
import styles from './page.module.css';

export default function Home() {
  const cat = getCatalogue();
  const facts = catalogueFacts(cat);
  const centella = getBotanical('centella')!;
  const counts = botanicalCounts(cat, 'centella');
  const weleda = getProduct('weleda-skin-food')!;
  const innisfree = getProduct('innisfree-green-tea-seed-hyaluronic-serum')!;

  return (
    <>
      <section className={styles.hero}>
        <div className={`wrap ${styles.heroGrid}`}>
          <div className={styles.heroText}>
            <h1>Botanical skincare, with the evidence on the label.</h1>
            <p className="lede">
              Take a photo for a YouCam skin analysis, say what you want and what you avoid, and SkinProof shows which products have
              research behind them, and exactly where that research stops.
            </p>
            <div className="actions">
              <Link href="/consult" className="btn">
                Start a consultation
              </Link>
              <Link href="/library" className="btn secondary">
                Browse the botanical library
              </Link>
            </div>
            <p className={`small ${styles.heroNote}`}>No account. Your photo is deleted after a day, or sooner if you ask.</p>
          </div>
          <div className={styles.heroPlate}>
            <SpecimenSheet
              botanical={centella}
              href="/library/centella"
              lines={[
                { term: 'Human studies', value: String(counts.human) },
                { term: 'Isolating trials', value: String(counts.isolatingTrials) },
                { term: 'On the label as', value: 'Centella Asiatica Leaf Extract, Madecassoside' },
              ]}
            />
            <p className={`small ${styles.plateCaption}`}>
              “Cica” is on dozens of labels. Every human study we found tested a whole multi-ingredient product or a medical group; none
              isolates Centella in everyday use.
            </p>
          </div>
        </div>
      </section>

      <section className={`wrap ${styles.method}`} aria-labelledby="method-title">
        <h2 id="method-title">How a product earns a place on your shortlist</h2>
        <p className={styles.methodIntro}>
          The Botanical Evidence Ledger checks every product in the same order, every time. Each stage can stop a product, and each
          decision records why.
        </p>
        <ol className={styles.stages}>
          {STAGES.map((s, i) => (
            <li key={s}>
              <span className={styles.stageNo}>{i + 1}</span>
              <span className={styles.stageName}>{s}</span>
            </li>
          ))}
        </ol>
        <div className={styles.cases}>
          <article className={styles.case}>
            <h3>An exclusion nothing can override</h3>
            <p>
              <strong>{weleda.brand} {weleda.name}</strong> has calendula and studies to go with it. If you ask for no added fragrance, it
              stops at stage one: its label lists <em>Fragrance (Parfum)</em>. No evidence, ranking or preference can bring it back.
            </p>
            <Link href={`/products/${weleda.id}`}>Open its dossier</Link>
          </article>
          <article className={styles.case}>
            <h3>The ingredient on the box is not the one that was studied</h3>
            <p>
              <strong>{innisfree.brand} {innisfree.name}</strong> is named after green tea seed oil. The green tea studies used leaf
              extract, so the seed oil earns nothing at stage four. The leaf extract further down the list does, and the dossier says how
              much is in it: the brand does not state an amount.
            </p>
            <Link href={`/products/${innisfree.id}`}>Open its dossier</Link>
          </article>
        </div>
      </section>

      <section className={`wrap ${styles.register}`} aria-labelledby="register-title">
        <h2 id="register-title">What we read, and what it supports</h2>
        <div className={styles.registerGrid}>
          <p className={styles.registerLine}>
            We read <span className="num">{facts.studies}</span> published studies on <span className="num">{facts.botanicals}</span>{' '}
            botanicals, each checked against PubMed.
          </p>
          <p className={styles.registerLine}>
            Only <span className="num">{facts.isolatingTrials}</span> are randomised trials in everyday use that isolate the botanical.{' '}
            <span className="num">{facts.wholeProductStudies}</span> tested whole products, and <span className="num">{facts.medical}</span>{' '}
            were in medical settings, which we show but do not count.
          </p>
          <p className={styles.registerLine}>
            We traced the full ingredient list of <span className="num">{facts.traced}</span> of <span className="num">{facts.skincare}</span> skincare products to a brand or retailer page;{' '}
            <span className="num">{facts.qualifying}</span> of them have human evidence on the same preparation for at least one goal. Only{' '}
            <span className="num">{facts.statedAmount}</span> state how much of an active they contain.
          </p>
        </div>
        <p>
          <Link href="/ledger">Read the full rules of the Ledger</Link>
        </p>
      </section>

      <section className={`wrap ${styles.tools}`} aria-labelledby="tools-title">
        <h2 id="tools-title" className="visually-hidden">
          What YouCam does here
        </h2>
        <div className={styles.tool}>
          <h3>Skin analysis</h3>
          <p>
            YouCam’s Skin AI scores eleven visible concerns, such as redness, moisture and texture, from one front-facing photo. SkinProof
            uses the model’s raw scores, relative to each other, to suggest where to focus. You choose the goals; the analysis never
            chooses a product.
          </p>
          <Link href="/consult">Start with a photo</Link>
        </div>
        <div className={styles.tool}>
          <h3>Lip colour try-on</h3>
          <p>
            For tinted lip balms, YouCam’s makeup try-on renders the shade on your own photo, with skin smoothing switched off so your
            skin is shown as it is. A try-on shows a colour. It says nothing about what a product does for your skin.
          </p>
          <Link href="/colour">See the lip colour shelf</Link>
        </div>
      </section>
    </>
  );
}
