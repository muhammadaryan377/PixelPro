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

import styles from "./dashboard.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Preset = {
  label: string;
  description: string;
  width: number;
  height: number;
  background: string;
  output_format: string;
  product_scale?: number;
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
  const [productScale, setProductScale] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);

  const batchLimit = me?.plan.batch_limit ?? 25;
  const monthlyRemaining = me ? Math.max(0, me.plan.images_per_month - me.usage.images_processed) : 0;
  const currentUploadLimit = Math.min(batchLimit, monthlyRemaining);
  const selectedPreset = presets[preset];
  const previews = useMemo(
    () => files.slice(0, 12).map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

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
    if (currentUploadLimit <= 0) {
      setFiles([]);
      setAudit(null);
      setMessage("Monthly image quota reached. Upgrade the workspace plan before processing another batch.");
      return;
    }

    const valid = Array.from(incoming).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );

    setFiles((current) => {
      const combined = [...current, ...valid];
      if (combined.length > currentUploadLimit) {
        setMessage(`Your current plan allows ${currentUploadLimit} more images in this batch.`);
      } else {
        setMessage(valid.length ? "" : "Only JPG, PNG and WEBP images are supported.");
      }
      return combined.slice(0, currentUploadLimit);
    });
    setAudit(null);
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
      form.append("job_name", jobName || "Automotive catalog batch");
      if (background) form.append("background", background);
      if (productScale) form.append("product_scale", productScale);

      const response = await fetch(`${API_URL}/api/v1/automotive/process-catalog`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!response.ok) {
        let detail = "Catalog processing failed";
        try {
          detail = (await response.json()).detail || detail;
        } catch {}
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
      setMessage(`Done — ${completed} images processed${failed !== "0" ? `, ${failed} failed` : ""}. Your catalog ZIP is ready.`);
      setFiles([]);
      setAudit(null);
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

  const usagePercent = me
    ? Math.min(100, Math.round((me.usage.images_processed / me.plan.images_per_month) * 100))
    : 0;

  if (loading) {
    return (
      <main className="workspace-loading">
        <Loader2 size={28} className="spin" />
        <strong>Loading PixelPro workspace…</strong>
      </main>
    );
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
          <div className="sidebar-usage-title">
            <span>{me?.plan.name || "Trial"}</span>
            <strong>{me?.usage.images_processed || 0}/{me?.plan.images_per_month || 250}</strong>
          </div>
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
          <section className={styles.heroPanel}>
            <div className={styles.heroCopy}>
              <div className={styles.heroEyebrow}><Sparkles size={15} /> Smart catalog processing</div>
              <h2>Upload your product images. PixelPro does the rest.</h2>
              <p>No editing experience needed. Upload auto-part photos, click process, and PixelPro automatically cleans, centers, standardizes and packages the catalog for you.</p>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.statPill}><small>Plan</small><strong>{me?.plan.name || "Trial"}</strong></div>
              <div className={styles.statPill}><small>Batch limit</small><strong>{batchLimit} images</strong></div>
              <div className={styles.statPill}><small>Remaining</small><strong>{monthlyRemaining} images</strong></div>
            </div>
          </section>

          <section className={styles.mainCard}>
            <div className={styles.cardTop}>
              <div className={styles.stepBlock}>
                <span className={styles.stepBadge}>01</span>
                <div><strong>Upload images</strong><span>Select one image or a complete supplier batch</span></div>
              </div>
              <span className={styles.smartTag}><CheckCircle2 size={14} /> Smart defaults ready</span>
            </div>

            <div className={styles.workspaceGrid}>
              <div className={styles.uploadColumn}>
                <div className={styles.dropZone} onDragOver={(event) => event.preventDefault()} onDrop={dropFiles}>
                  <input
                    id="catalog-files"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={chooseFiles}
                    disabled={monthlyRemaining === 0}
                  />
                  <label htmlFor="catalog-files" className={styles.dropContent}>
                    <span className={styles.uploadIcon}><UploadCloud size={30} /></span>
                    <strong>{monthlyRemaining === 0 ? "Monthly image quota reached" : "Drop your auto-part images here"}</strong>
                    <span>{monthlyRemaining === 0 ? "Upgrade your plan to process more images" : "or click anywhere in this box to choose files"}</span>
                    <small>JPG, PNG or WEBP · up to 20MB each · maximum {currentUploadLimit} images right now</small>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className={styles.previewArea}>
                    <div className={styles.previewHeader}>
                      <strong>{files.length} image{files.length === 1 ? "" : "s"} ready</strong>
                      <button className={styles.clearButton} onClick={() => { setFiles([]); setAudit(null); }}><X size={14} /> Clear</button>
                    </div>
                    <div className={styles.previewGrid}>
                      {previews.map(({ file, url }) => (
                        <div className={styles.previewTile} key={`${file.name}-${file.lastModified}`}>
                          <img src={url} alt="" />
                          <span>{file.name}</span>
                        </div>
                      ))}
                      {files.length > 12 && <div className={styles.previewMore}>+{files.length - 12}<small>more</small></div>}
                    </div>
                  </div>
                )}
              </div>

              <aside className={styles.actionColumn}>
                <div className={styles.actionHeader}>
                  <small>STEP 02</small>
                  <h3>Ready to process</h3>
                  <p>PixelPro will use the recommended automotive catalog settings automatically.</p>
                </div>

                <div className={styles.defaultCard}>
                  <div className={styles.defaultTop}>
                    <span className={styles.defaultIcon}><FileCheck2 size={17} /></span>
                    <div>
                      <strong>{selectedPreset?.label || "Auto Parts — White Marketplace"}</strong>
                      <span>{selectedPreset ? `${selectedPreset.width} × ${selectedPreset.height} · ${selectedPreset.output_format}` : "1600 × 1600 · JPEG"}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.autoList}>
                  <span className={styles.autoItem}><CheckCircle2 size={15} /> Clean inconsistent backgrounds</span>
                  <span className={styles.autoItem}><CheckCircle2 size={15} /> Center products with consistent spacing</span>
                  <span className={styles.autoItem}><CheckCircle2 size={15} /> Preserve physical labels and part markings</span>
                  <span className={styles.autoItem}><CheckCircle2 size={15} /> Flag likely duplicate photos</span>
                  <span className={styles.autoItem}><CheckCircle2 size={15} /> Create catalog manifest and batch report</span>
                </div>

                <button
                  className={styles.processButton}
                  onClick={processCatalog}
                  disabled={!files.length || processing || monthlyRemaining === 0}
                >
                  {processing ? <><Loader2 size={18} className={styles.spin} /> Processing {files.length} image{files.length === 1 ? "" : "s"}…</> : <><CloudDownload size={18} /> {files.length ? `Process ${files.length} image${files.length === 1 ? "" : "s"}` : "Upload images to start"}</>}
                </button>

                <button className={styles.auditButton} onClick={auditFirstImage} disabled={!files.length || auditing}>
                  {auditing ? <Loader2 size={16} className={styles.spin} /> : <ScanSearch size={16} />} Optional quality check
                </button>

                <button className={styles.advancedToggle} onClick={() => setShowAdvanced((value) => !value)}>
                  <span><Settings2 size={15} /> Advanced settings</span>
                  <span>{showAdvanced ? "Hide" : "Show"}</span>
                </button>

                {showAdvanced && (
                  <div className={styles.advancedPanel}>
                    <label className={styles.fieldLabel}>Output preset
                      <select value={preset} onChange={(event) => { setPreset(event.target.value); setProductScale(""); setBackground(""); }}>
                        {Object.entries(presets).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                      </select>
                    </label>
                    {selectedPreset && <div className={styles.presetHint}>{selectedPreset.description}</div>}
                    <div className={styles.fieldPair}>
                      <label className={styles.fieldLabel}>Vendor / supplier
                        <input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="Optional" />
                      </label>
                      <label className={styles.fieldLabel}>SKU prefix
                        <input value={skuPrefix} onChange={(event) => setSkuPrefix(event.target.value)} placeholder="PART" />
                      </label>
                    </div>
                    <label className={styles.fieldLabel}>Job name
                      <input value={jobName} onChange={(event) => setJobName(event.target.value)} />
                    </label>
                    <div className={styles.fieldPair}>
                      <label className={styles.fieldLabel}>Background override
                        <input value={background} onChange={(event) => setBackground(event.target.value)} placeholder={selectedPreset?.background || "Use preset"} />
                      </label>
                      <label className={styles.fieldLabel}>Product scale override
                        <input type="number" min="0.2" max="0.95" step="0.01" value={productScale} onChange={(event) => setProductScale(event.target.value)} placeholder={selectedPreset?.product_scale?.toString() || "Use preset"} />
                      </label>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </section>

          {audit && (
            <section className={styles.auditCard}>
              <div className={styles.auditScore}><strong>{audit.score}</strong><span>/100</span></div>
              <div className={styles.auditCopy}>
                <small>QUALITY AUDIT · {audit.filename}</small>
                <h3>{audit.status === "ready" ? "Ready for processing" : "Review recommended"}</h3>
                {audit.issues.length ? (
                  <ul>{audit.issues.map((issue) => <li key={issue}><AlertTriangle size={14} /> {issue}</li>)}</ul>
                ) : <p>No major catalog-quality issues detected.</p>}
              </div>
            </section>
          )}

          {message && <div className={styles.message}><CheckCircle2 size={17} /> <span>{message}</span></div>}

          <section className={styles.history} id="history">
            <div className={styles.historyHeader}>
              <div><small>OPERATIONS</small><h2>Recent jobs</h2></div>
              <button className={styles.refreshButton} onClick={refreshAccount}>Refresh</button>
            </div>
            <div className={styles.jobs}>
              <div className={`${styles.jobRow} ${styles.jobHead}`}><span>Job</span><span>Status</span><span>Preset</span><span>Images</span><span>Created</span><span /></div>
              {jobs.length === 0 ? (
                <div className={styles.empty}><Images size={25} /><strong>No catalog jobs yet</strong><span>Your first processed batch will appear here.</span></div>
              ) : jobs.map((job) => (
                <div className={styles.jobRow} key={job.id}>
                  <span className={styles.jobMain}><strong>{job.name}</strong><small>{job.id}</small></span>
                  <span><em className={styles.status}>{job.status.replaceAll("_", " ")}</em></span>
                  <span>{presets[job.preset]?.label || job.preset}</span>
                  <span>{job.completed}/{job.total}{job.failed ? ` · ${job.failed} failed` : ""}</span>
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                  <span><ChevronRight size={16} /></span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
