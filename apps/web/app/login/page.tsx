"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Boxes, CheckCircle2, Loader2, LockKeyhole, Mail, Warehouse } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoint = mode === "signup" ? "/api/v1/account/signup" : "/api/v1/account/login";
      const payload = mode === "signup" ? { email, password, company } : { email, password };
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not continue");
      localStorage.setItem("pixelpro_token", data.token);
      localStorage.setItem("pixelpro_user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand-panel">
        <Link href="/" className="brand-mark brand-mark-light">
          <span className="brand-icon"><Boxes size={20} /></span>
          <span><strong>PixelPro</strong><small>Automotive</small></span>
        </Link>
        <div className="auth-value">
          <div className="eyebrow light"><Warehouse size={16} /> Catalog operations workspace</div>
          <h1>Standardize hundreds of parts images in one repeatable workflow.</h1>
          <ul className="auth-benefits">
            <li><CheckCircle2 size={18} /> Automotive-specific catalog presets</li>
            <li><CheckCircle2 size={18} /> Batch images + CSV manifest export</li>
            <li><CheckCircle2 size={18} /> Quality and possible-duplicate checks</li>
          </ul>
        </div>
        <p className="auth-legal">Use PixelPro only for images your company owns or is authorized to edit.</p>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to PixelPro</Link>
          <div className="auth-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create workspace</button>
          </div>

          <div className="auth-heading">
            <h2>{mode === "signup" ? "Create your automotive workspace" : "Welcome back"}</h2>
            <p>{mode === "signup" ? "Start with the free trial and process your first catalog batch." : "Continue to your PixelPro catalog operations dashboard."}</p>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === "signup" && (
              <label>
                <span>Company</span>
                <div className="input-shell"><Warehouse size={17} /><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Apex Auto Parts" minLength={2} required /></div>
              </label>
            )}
            <label>
              <span>Email</span>
              <div className="input-shell"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@company.com" required /></div>
            </label>
            <label>
              <span>Password</span>
              <div className="input-shell"><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" minLength={mode === "signup" ? 8 : 1} required /></div>
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="button button-primary button-full button-large" disabled={busy}>
              {busy ? <><Loader2 size={18} className="spin" /> Working…</> : mode === "signup" ? "Create free workspace" : "Sign in to PixelPro"}
            </button>
          </form>

          <p className="form-note">Commercial V1 uses secure password hashing and server-side sessions. Production billing/SSO can be connected before public launch.</p>
        </div>
      </div>
    </main>
  );
}
