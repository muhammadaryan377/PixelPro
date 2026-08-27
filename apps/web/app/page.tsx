import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CarFront,
  CheckCircle2,
  FileArchive,
  Gauge,
  Images,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UploadCloud,
  Wrench,
} from "lucide-react";

import SiteNav from "./components/SiteNav";

const workflow = [
  { icon: UploadCloud, title: "Upload supplier photos", text: "Drop a warehouse batch, supplier export or used-parts photo set." },
  { icon: ScanSearch, title: "Normalize automatically", text: "Remove inconsistent backgrounds, center parts, standardize scale and run quality checks." },
  { icon: FileArchive, title: "Export the catalog", text: "Download processed assets with SKU-safe filenames, CSV manifest and a batch report." },
];

const capabilities = [
  "Background removal and cleanup",
  "Part centering with consistent margins",
  "White, blue and studio catalog presets",
  "Large batch ZIP processing",
  "SKU-safe output filenames",
  "Image quality scoring",
  "Possible duplicate detection",
  "CSV catalog manifest",
  "Processing history and usage tracking",
];

export default function Home() {
  return (
    <main>
      <SiteNav />

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><CarFront size={16} /> Built for automotive ecommerce teams</div>
          <h1>Turn messy auto-part photos into a clean catalog at scale.</h1>
          <p className="hero-lead">
            PixelPro standardizes supplier, warehouse and dismantler product images into consistent ecommerce-ready assets — with batch processing, quality checks and catalog metadata built in.
          </p>
          <div className="hero-actions">
            <Link href="/login?mode=signup" className="button button-primary button-large">Start free workspace <ArrowRight size={18} /></Link>
            <Link href="/dashboard" className="button button-ghost button-large"><Gauge size={18} /> Open catalog studio</Link>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> Customer-owned or authorized imagery</span>
            <span><BadgeCheck size={17} /> Repeatable catalog output</span>
            <span><TimerReset size={17} /> Built for batch workflows</span>
          </div>
        </div>

        <div className="hero-product-card" aria-label="PixelPro automotive batch preview">
          <div className="product-card-top">
            <div>
              <small>CATALOG JOB</small>
              <strong>Brake & suspension batch</strong>
            </div>
            <span className="status-pill">Processing</span>
          </div>
          <div className="part-grid">
            {["Alternator", "Brake caliper", "Control arm", "Headlamp"].map((name, index) => (
              <div className="part-tile" key={name}>
                <div className={`part-shape part-shape-${index + 1}`}><Wrench size={34} /></div>
                <span>{name}</span>
                <small>SKU {4120 + index}</small>
              </div>
            ))}
          </div>
          <div className="product-card-footer">
            <div><strong>186</strong><span>Ready</span></div>
            <div><strong>8</strong><span>Review</span></div>
            <div><strong>3</strong><span>Duplicates</span></div>
            <div><strong>CSV</strong><span>Manifest</span></div>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="shell proof-grid">
          <div><strong>One batch</strong><span>raw photos → catalog assets</span></div>
          <div><strong>6 presets</strong><span>white, blue, studio, web + marketplace profiles</span></div>
          <div><strong>1 export</strong><span>images + manifest + report</span></div>
          <div><strong>Auto focused</strong><span>parts sellers, dealers, dismantlers</span></div>
        </div>
      </section>

      <section className="section shell" id="workflow">
        <div className="section-heading centered">
          <div className="eyebrow"><Sparkles size={16} /> A catalog workflow, not another photo editor</div>
          <h2>From supplier folder to publishable product library.</h2>
          <p>PixelPro reduces repetitive image prep while keeping genuine product labels, part numbers and physical markings intact unless the catalog owner intentionally chooses otherwise.</p>
        </div>
        <div className="workflow-grid">
          {workflow.map(({ icon: Icon, title, text }, index) => (
            <article className="workflow-card" key={title}>
              <div className="step-number">0{index + 1}</div>
              <div className="feature-icon"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="buyers">
        <div className="shell split-section">
          <div>
            <div className="eyebrow light"><Boxes size={16} /> Designed around automotive inventory</div>
            <h2>Useful where image volume hurts.</h2>
            <p className="muted-light">Ideal for teams that receive inconsistent images from multiple suppliers and need a repeatable catalog standard without manually opening every photo.</p>
            <div className="buyer-tags">
              <span>Auto parts ecommerce</span>
              <span>Parts distributors</span>
              <span>Vehicle dismantlers</span>
              <span>Dealership groups</span>
              <span>Marketplace sellers</span>
              <span>Catalog agencies</span>
            </div>
          </div>
          <div className="capability-panel">
            <div className="panel-title"><Images size={19} /> Commercial V1 capabilities</div>
            <ul className="check-list">
              {capabilities.map((item) => <li key={item}><CheckCircle2 size={17} /> {item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="sale-card">
          <div>
            <div className="eyebrow"><CarFront size={16} /> Build value before the acquisition</div>
            <h2>PixelPro is now being shaped as an automotive image-operations product.</h2>
            <p>The stronger the recurring customer usage, catalog volume, retention and operational documentation become, the stronger the software is as an acquisition asset.</p>
          </div>
          <Link href="/pricing" className="button button-primary button-large">View commercial plans <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="footer shell">
        <Link href="/" className="brand-mark">
          <span className="brand-icon"><Boxes size={20} /></span>
          <span><strong>PixelPro</strong><small>Automotive</small></span>
        </Link>
        <p>Automotive ecommerce image operations. Process only imagery you own or are authorized to edit.</p>
      </footer>
    </main>
  );
}
