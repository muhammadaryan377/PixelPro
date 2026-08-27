import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import SiteNav from "../components/SiteNav";

const plans = [
  { name: "Trial", price: "$0", note: "Validate the workflow", images: "250 images / month", batch: "25 per batch", features: ["Automotive presets", "Quality audit", "ZIP export"] },
  { name: "Starter", price: "$49", note: "Small parts stores", images: "1,000 images / month", batch: "100 per batch", features: ["Catalog manifests", "SKU-safe filenames", "Processing history"] },
  { name: "Business", price: "$149", note: "Growing ecommerce teams", images: "5,000 images / month", batch: "250 per batch", features: ["Everything in Starter", "Priority workflow", "Team-ready architecture"], featured: true },
  { name: "Agency", price: "$399", note: "High-volume operators", images: "20,000 images / month", batch: "500 per batch", features: ["Everything in Business", "API-ready plan", "White-label ready"] },
];

export default function PricingPage() {
  return (
    <main>
      <SiteNav />
      <section className="pricing-hero shell">
        <div className="eyebrow"><ShieldCheck size={16} /> Commercial V1 pricing model</div>
        <h1>Price around image volume, not editor seats.</h1>
        <p>Simple plans for automotive teams that need repeatable catalog operations. Final public pricing should be validated against real processing cost and customer willingness to pay before launch.</p>
      </section>

      <section className="pricing-grid shell">
        {plans.map((plan) => (
          <article className={`pricing-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
            {plan.featured && <span className="popular-pill">Recommended</span>}
            <small>{plan.note}</small>
            <h2>{plan.name}</h2>
            <div className="price-line"><strong>{plan.price}</strong><span>/ month</span></div>
            <div className="plan-volume"><strong>{plan.images}</strong><span>{plan.batch}</span></div>
            <ul>
              {plan.features.map((feature) => <li key={feature}><CheckCircle2 size={16} /> {feature}</li>)}
            </ul>
            <Link href="/login?mode=signup" className={`button button-full ${plan.featured ? "button-primary" : "button-ghost"}`}>Create workspace <ArrowRight size={16} /></Link>
          </article>
        ))}
      </section>

      <section className="section shell">
        <div className="enterprise-card">
          <div><small>ENTERPRISE / ACQUISITION READY</small><h2>Private deployment, white-label or strategic ownership discussions.</h2><p>For distributors, marketplace operators or software groups that want PixelPro integrated into their own catalog pipeline.</p></div>
          <Link href="/login?mode=signup" className="button button-primary button-large">Start with a workspace <ArrowRight size={18} /></Link>
        </div>
      </section>
    </main>
  );
}
