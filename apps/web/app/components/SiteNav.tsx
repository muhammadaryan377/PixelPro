import Link from "next/link";
import { Boxes, Gauge, LogIn } from "lucide-react";

export default function SiteNav() {
  return (
    <header className="site-nav-wrap">
      <nav className="site-nav shell">
        <Link href="/" className="brand-mark" aria-label="PixelPro home">
          <span className="brand-icon"><Boxes size={20} /></span>
          <span>
            <strong>PixelPro</strong>
            <small>Automotive</small>
          </span>
        </Link>
        <div className="nav-links">
          <Link href="/#workflow">Workflow</Link>
          <Link href="/#buyers">For teams</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div className="nav-actions">
          <Link href="/login" className="button button-ghost"><LogIn size={16} /> Sign in</Link>
          <Link href="/dashboard" className="button button-primary"><Gauge size={16} /> Open studio</Link>
        </div>
      </nav>
    </header>
  );
}
