"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  CloudDownload,
  FileArchive,
  FileCheck2,
  Gauge,
  History,
  Images,
  Loader2,
  LogOut,
  ScanSearch,
  Settings2,
  Sparkles,
  UploadCloud,
  Warehouse,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Preset = {
  label: string;
  description: string;
  width: number;
  height: number;
  background: string;
  output_format: string;
};

type MeResponse = {
  user: { id: string; email: string; company: string };
  plan: { id: string; name: string; images_per_month: number; batch_limit: number };
  usage: { images_processed: number; month: string };
};

type Job = {
  id: string;
  name: string;
  status: string;
  total: number;
  completed: number;
  failed: number;
  preset: string;
  created_at: string;
};

type AuditResult = {
  filename: string;
  score: number;
  status: string;
  issues: string[];
  report: Record<string, unknown>;
};

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [presets, setPresets] = useState<Record<string, Preset>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [preset, setPreset] = useState("auto-white-1600");
  const [vendor, setVendor] = useState("");
  const [skuPrefix, setSkuPrefix] = useState("PART");
  const [jobName, setJobName] = useState("Automotive catalog batch");
  const [background, setBackground] = useState("");
  const [productScale, setProductScale] = useState("0.80");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);

  const batchLimit = me?.plan.batch_limit ?? 25;
  const monthlyRemaining = me ? Math.max(0, me.plan.images_per_month - me.usage.images_processed) : 0;
  const currentUploadLimit = Math.max(0, Math.min(batchLimit, monthlyRemaining || batchLimit));
  const previews = useMemo(() => files.slice(0, 8).map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => {
    return () => previews.forEach((item) => URL.revokeObjectURL(item.url));
  }, [previews]);

  useEffect(() => {
    const saved = localStorage.getItem("pixelpro_token") || "";
    if (!saved) {
      window.location.href = "/login";
      return;
    }
    setToken(saved);

    async function boot() {
      try {
        const [meResponse, presetResponse, jobsResponse] = await Promise.all([
          fetch(`${API_URL}/api/v1/account/me`, { headers: { Authorization: `Bearer ${saved}` } }),
          fetch(`${API_URL}/api/v1/automotive/presets`),
          fetch(`${API_URL}/api/v1/jobs`, { headers: { Authorization: `Bearer ${saved}` } }),
        ]);
        if (meResponse.status === 401) {
          localStorage.removeItem("pixelpro_token");
          window.location.href = "/login";
          return;
        }
        if (!meResponse.ok || !presetResponse.ok || !jobsResponse.ok) throw new Error("Could not load workspace");
        setMe(await meResponse.json());
        setPresets(await presetResponse.json());
        setJobs((await jobsResponse.json()).jobs || []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load workspace");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  function addFiles(incoming: FileList | File[]) {
    const next = Array.from(incoming).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    const limit = currentUploadLimit || batchLimit;
    setFiles((current) => [...current, ...next].slice(0, limit));
    setAudit(null);
    setMessage(next.length ? "" : "Only JPG, PNG and WEBP images are supported.");
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function dropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  async function refreshAccount() {
    if (!token) return;
    const [meResponse, jobsResponse] = await Promise.all([
      fetch(`${API_URL}/api/v1/account/me`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/v1/jobs`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (meResponse.ok) setMe(await meResponse.json());
    if (jobsResponse.ok) setJobs((await jobsResponse.json()).jobs || []);
  }

  async function processCatalog() {
    if (!files.length || !token) return;
    setProcessing(true);
    setMessage("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("preset", preset);
      form.append("vendor", vendor);
      form.append("sku_prefix", skuPrefix);
      form.append("job_name", jobName);
      if (background) form.append("background", background);
      if (productScale) form.append("product_scale", productScale);

      const response = await fetch(`${API_URL}/api/v1/automotive/process-catalog`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!response.ok) {
        let detail = "Catalog processing failed";
        try { detail = (await response.json()).detail || detail; } catch {}
        throw new Error(detail);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pixelpro-automotive-${Date.now()}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      const completed = response.headers.get("X-PixelPro-Completed") || files.length.toString();
      const failed = response.headers.get("X-PixelPro-Failed") || "0";
      setMessage(`Catalog exported: ${completed} processed, ${failed} failed. ZIP includes images, CSV manifest and batch report.`);
      setFiles([]);
      await refreshAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Catalog processing failed");
    } finally {
      setProcessing(false);
    }
  }

  async function auditFirstImage() {
    if (!files.length) return;
    setAuditing(true);
    setAudit(null);
    try {
      const form = new FormData();
      form.append("file", files[0]);
      const response = await fetch(`${API_URL}/api/v1/automotive/audit`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Audit failed");
      setAudit(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audit failed");
    } finally {
      setAuditing(false);
    }
  }

  function signOut() {
    localStorage.removeItem("pixelpro_token");
    localStorage.removeItem("pixelpro_user");
    window.location.href = "/login";
  }

  const usagePercent = me ? Math.min(100, Math.round((me.usage.images_processed / me.plan.images_per_month) * 100)) : 0;

  if (loading) {
    return <main className="workspace-loading"><Loader2 size={28} className="spin" /><strong>Loading PixelPro workspace…</strong></main>;
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="brand-mark brand-mark-light">
          <span className="brand-icon"><Boxes size={20} /></span>
          <span><strong>PixelPro</strong><small>Automotive</small></span>
        </Link>
        <nav className="side-nav">
          <a className="active" href="#studio"><Gauge size={18} /> Catalog Studio</a>
          <a href="#history"><History size={18} /> Job History</a>
          <Link href="/pricing"><Sparkles size={18} /> Plans</Link>
        </nav>
        <div className="sidebar-usage">
          <div className="sidebar-usage-title"><span>{me?.plan.name || "Trial"}</span><strong>{me?.usage.images_processed || 0}/{me?.plan.images_per_month || 250}</strong></div>
          <div className="usage-bar"><span style={{ width: `${usagePercent}%` }} /></div>
          <small>Images processed this month</small>
        </div>
        <button className="side-user" onClick={signOut}>
          <CircleUserRound size={28} />
          <span><strong>{me?.user.company || "Workspace"}</strong><small>{me?.user.email || ""}</small></span>
          <LogOut size={17} />
        </button>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div><small>AUTOMOTIVE OPERATIONS</small><h1>Catalog Studio</h1></div>
          <div className="topbar-badge"><Warehouse size={17} /> {me?.user.company}</div>
        </header>

        <div className="workspace-content" id="studio">
          <div className="workspace-intro">
            <div>
              <h2>Build a consistent parts catalog from raw product photos.</h2>
              <p>Your {me?.plan.name || "Trial"} plan allows {batchLimit} images per batch and {me?.plan.images_per_month || 250} images per month. PixelPro standardizes each part, flags likely duplicates and exports a manifest alongside the processed images.</p>
            </div>
            <button className="button button-ghost" onClick={auditFirstImage} disabled={!files.length || auditing}>
              {auditing ? <Loader2 size={17} className="spin" /> : <ScanSearch size={17} />} Audit first image
            </button>
          </div>

          <div className="studio-grid">
            <section className="studio-card studio-upload-card">
              <div className="card-heading"><div><small>STEP 1</small><h3>Upload product images</h3></div><span>{files.length}/{currentUploadLimit || batchLimit}</span></div>
              <div className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={dropFiles}>
                <input id="catalog-files" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseFiles} disabled={monthlyRemaining === 0} />
                <label htmlFor="catalog-files">
                  <span className="upload-icon"><UploadCloud size={28} /></span>
                  <strong>{monthlyRemaining === 0 ? "Monthly image quota reached" : "Drop supplier or warehouse images here"}</strong>
                  <span>{monthlyRemaining === 0 ? "Choose a higher plan when billing is enabled" : "or click to browse your computer"}</span>
                  <small>JPG, PNG, WEBP · 20MB each · {monthlyRemaining} monthly images remaining</small>
                </label>
              </div>

              {files.length > 0 && (
                <div className="preview-area">
                  <div className="preview-top"><strong>{files.length} images selected</strong><button onClick={() => setFiles([])}><X size={15} /> Clear</button></div>
                  <div className="preview-grid">
                    {previews.map(({ file, url }) => <div className="preview-tile" key={`${file.name}-${file.lastModified}`}><img src={url} alt="" /><span>{file.name}</span></div>)}
                    {files.length > 8 && <div className="preview-more">+{files.length - 8}<small>more</small></div>}
                  </div>
                </div>
              )}
            </section>

            <section className="studio-card settings-card">
              <div className="card-heading"><div><small>STEP 2</small><h3>Catalog standard</h3></div><Settings2 size={20} /></div>
              <label className="field-label">Preset
                <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                  {Object.entries(presets).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                </select>
              </label>
              {presets[preset] && <div className="preset-note"><FileCheck2 size={17} /><div><strong>{presets[preset].width} × {presets[preset].height} · {presets[preset].output_format}</strong><span>{presets[preset].description}</span></div></div>}
              <div className="field-pair">
                <label className="field-label">Vendor / supplier<input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Bosch / Supplier A" /></label>
                <label className="field-label">Fallback SKU prefix<input value={skuPrefix} onChange={(e) => setSkuPrefix(e.target.value)} placeholder="PART" /></label>
              </div>
              <label className="field-label">Job name<input value={jobName} onChange={(e) => setJobName(e.target.value)} /></label>
              <div className="field-pair">
                <label className="field-label">Optional background override<input value={background} onChange={(e) => setBackground(e.target.value)} placeholder="#FFFFFF" /></label>
                <label className="field-label">Product scale<input type="number" min="0.2" max="0.95" step="0.01" value={productScale} onChange={(e) => setProductScale(e.target.value)} /></label>
              </div>
              <div className="setting-checks">
                <span><CheckCircle2 size={16} /> Preserve physical labels/markings</span>
                <span><CheckCircle2 size={16} /> Flag possible duplicate images</span>
                <span><CheckCircle2 size={16} /> Generate CSV manifest</span>
              </div>
            </section>
          </div>

          {audit && (
            <section className={`audit-card audit-${audit.status}`}>
              <div className="audit-score"><strong>{audit.score}</strong><span>/100</span></div>
              <div><small>QUALITY AUDIT · {audit.filename}</small><h3>{audit.status === "ready" ? "Ready for processing" : "Review recommended"}</h3>
                {audit.issues.length ? <ul>{audit.issues.map((issue) => <li key={issue}><AlertTriangle size={15} /> {issue}</li>)}</ul> : <p>No major catalog-quality issues detected.</p>}
              </div>
            </section>
          )}

          <section className="export-card">
            <div className="export-copy">
              <span className="export-icon"><FileArchive size={25} /></span>
              <div><small>STEP 3</small><h3>Process and export catalog</h3><p>Your ZIP will contain normalized product images, <code>catalog-manifest.csv</code> and <code>batch-report.json</code>.</p></div>
            </div>
            <button className="button button-primary button-large" onClick={processCatalog} disabled={!files.length || processing || monthlyRemaining === 0}>
              {processing ? <><Loader2 size={18} className="spin" /> Processing {files.length} images…</> : <><CloudDownload size={18} /> Process & download ZIP</>}
            </button>
          </section>

          {message && <div className="workspace-message"><CheckCircle2 size={18} /> {message}</div>}

          <section className="history-section" id="history">
            <div className="history-heading"><div><small>OPERATIONS</small><h2>Recent jobs</h2></div><button className="button button-ghost" onClick={refreshAccount}>Refresh</button></div>
            <div className="jobs-table">
              <div className="job-row job-header"><span>Job</span><span>Status</span><span>Preset</span><span>Images</span><span>Created</span><span /></div>
              {jobs.length === 0 ? <div className="empty-jobs"><Images size={26} /><strong>No catalog jobs yet</strong><span>Your first processed batch will appear here.</span></div> : jobs.map((job) => (
                <div className="job-row" key={job.id}>
                  <span><strong>{job.name}</strong><small>{job.id}</small></span>
                  <span><em className={`job-status ${job.status}`}>{job.status.replaceAll("_", " ")}</em></span>
                  <span>{presets[job.preset]?.label || job.preset}</span>
                  <span>{job.completed}/{job.total}{job.failed ? <small>{job.failed} failed</small> : null}</span>
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                  <span><ChevronRight size={17} /></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
