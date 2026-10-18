import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap page">
      <header className="page-head">
        <h1>Not in the catalogue</h1>
        <p>This page does not exist, or the product or botanical has been removed.</p>
      </header>
      <div className="actions">
        <Link href="/products" className="btn">
          Browse the apothecary
        </Link>
        <Link href="/library" className="btn secondary">
          Open the botanical library
        </Link>
      </div>
    </div>
  );
}
