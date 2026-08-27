"use client";

import { ChangeEvent, DragEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BoxSelect,
  Brush,
  Download,
  Eraser,
  ImagePlus,
  Layers3,
  Maximize2,
  ScanSearch,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Item = { id: string; file: File; url: string };
type Format = "JPEG" | "PNG" | "WEBP";
type BackgroundStyle = "solid" | "transparent" | "studio" | "soft-gray" | "warm-studio";

type Settings = {
  width: number;
  height: number;
  background: string;
  background_style: BackgroundStyle;
  transparent_background: boolean;
  product_scale: number;
  padding: number;
  offset_x: number;
  offset_y: number;
  remove_bg: boolean;
  enhance_quality: boolean;
  white_balance: boolean;
  denoise_strength: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  upscale_factor: number;
  add_product_shadow: boolean;
  shadow_opacity: number;
  shadow_blur: number;
  output_format: Format;
  quality: number;
};

type QualityReport = {
  width: number;
  height: number;
  blurry: boolean;
  resolution_ok: boolean;
  too_dark: boolean;
  too_bright: boolean;
  sharpness_score: number;
  [key: string]: unknown;
};

const DEFAULTS: Settings = {
  width: 1024,
  height: 1024,
  background: "#FFFFFF",
  background_style: "solid",
  transparent_background: false,
  product_scale: 0.75,
  padding: 0.15,
  offset_x: 0,
  offset_y: 0,
  remove_bg: true,
  enhance_quality: true,
  white_balance: false,
  denoise_strength: 0,
  brightness: 1,
  contrast: 1.06,
  saturation: 1,
  sharpness: 1.18,
  upscale_factor: 1,
  add_product_shadow: false,
  shadow_opacity: 72,
  shadow_blur: 24,
  output_format: "JPEG",
  quality: 95,
};

const presets: Record<string, Partial<Settings>> = {
  "pixelpro-square": DEFAULTS,
  "amazon-main": { width: 2000, height: 2000, background: "#FFFFFF", background_style: "solid", product_scale: 0.85, padding: 0.075, output_format: "JPEG", quality: 95 },
  "shopify-square": { width: 2048, height: 2048, background: "#FFFFFF", background_style: "solid", product_scale: 0.8, padding: 0.1, output_format: "WEBP", quality: 92 },
  "etsy-square": { width: 2000, height: 2000, background: "#FFFFFF", background_style: "solid", product_scale: 0.82, padding: 0.09, output_format: "JPEG", quality: 92 },
  "ebay-square": { width: 1600, height: 1600, background: "#FFFFFF", background_style: "solid", product_scale: 0.82, padding: 0.09, output_format: "JPEG", quality: 92 },
  "walmart-square": { width: 2000, height: 2000, background: "#FFFFFF", background_style: "solid", product_scale: 0.82, padding: 0.09, output_format: "JPEG", quality: 94 },
  "social-square": { width: 1080, height: 1080, background_style: "studio", product_scale: 0.78, padding: 0.11 },
  "social-portrait": { width: 1080, height: 1350, background_style: "studio", product_scale: 0.78, padding: 0.11 },
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function CleanupDialog({ item, onClose, onResult }: { item: Item; onClose: () => void; onResult: (blob: Blob) => void }) {
  const imageCanvas = useRef<HTMLCanvasElement>(null);
  const maskCanvas = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(36);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Paint over the watermark or unwanted mark, then run removal.");

  useEffect(() => {
    const image = new Image();
    image.src = item.url;
    image.onload = () => {
      const maxSide = 1400;
      const factor = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * factor));
      const height = Math.max(1, Math.round(image.naturalHeight * factor));
      const base = imageCanvas.current;
      const mask = maskCanvas.current;
      if (!base || !mask) return;
      base.width = mask.width = width;
      base.height = mask.height = height;
      base.getContext("2d")?.drawImage(image, 0, 0, width, height);
      const mctx = mask.getContext("2d");
      if (mctx) mctx.clearRect(0, 0, width, height);
    };
  }, [item]);

  function paint(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const mask = maskCanvas.current;
    if (!mask) return;
    const rect = mask.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (mask.width / rect.width);
    const y = (event.clientY - rect.top) * (mask.height / rect.height);
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "rgba(255,40,40,.55)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize * (mask.width / rect.width) / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  async function runCleanup() {
    const mask = maskCanvas.current;
    if (!mask) return;
    setBusy(true);
    setMessage("Cleaning selected area…");
    try {
      const maskBlob = await new Promise<Blob | null>((resolve) => mask.toBlob(resolve, "image/png"));
      if (!maskBlob) throw new Error("Could not create mask");
      const body = new FormData();
      body.append("file", item.file);
      body.append("mask", maskBlob, "mask.png");
      body.append("radius", "5");
      const response = await fetch(`${API_URL}/api/v1/cleanup`, { method: "POST", body });
      if (!response.ok) throw new Error((await response.json()).detail ?? "Cleanup failed");
      const blob = await response.blob();
      onResult(blob);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cleanup failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAutoCleanup() {
    setBusy(true);
    setMessage("Groq AI is detecting watermark regions…");
    try {
      const body = new FormData();
      body.append("file", item.file);
      const response = await fetch(`${API_URL}/api/v1/auto-watermark-removal`, { method: "POST", body });
      if (!response.ok) {
        let detail = "AI watermark removal failed";
        try { detail = (await response.json()).detail ?? detail; } catch { /* use fallback */ }
        throw new Error(detail);
      }
      const count = response.headers.get("X-Watermarks-Detected") ?? "1";
      const blob = await response.blob();
      setMessage(`${count} watermark region(s) removed`);
      onResult(blob);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI watermark removal failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modalbackdrop" role="dialog" aria-modal="true" aria-label="Watermark and object remover">
      <div className="modalcard">
        <div className="sectionhead"><div><h3>Watermark / Object Remover</h3><p className="muted">Paint over the unwanted area. Use only on images you own or are authorized to edit.</p></div><button className="ghost" onClick={onClose}>Close</button></div>
        <div className="cleanupstage">
          <canvas ref={imageCanvas} className="cleanupcanvas" />
          <canvas ref={maskCanvas} className="cleanupcanvas mask" onPointerDown={(e) => { setDrawing(true); e.currentTarget.setPointerCapture(e.pointerId); paint(e); }} onPointerMove={paint} onPointerUp={() => setDrawing(false)} onPointerCancel={() => setDrawing(false)} />
        </div>
        <div className="cleanupcontrols"><label>Brush <input type="range" min="10" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))}/></label><button className="ghost" disabled={busy} onClick={() => maskCanvas.current?.getContext("2d")?.clearRect(0, 0, maskCanvas.current.width, maskCanvas.current.height)}>Clear mask</button><button className="secondary" disabled={busy} onClick={runAutoCleanup}><Sparkles size={16}/>{busy ? "AI working…" : "Auto Detect + Remove"}</button><button className="primary" disabled={busy} onClick={runCleanup}>{busy ? "Removing…" : "Remove painted area"}</button></div>
        <div className="status">{message}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [batchUrl, setBatchUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [preset, setPreset] = useState("pixelpro-square");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready to process");
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);

  const active = useMemo(() => items.find((x) => x.id === activeId) ?? items[0] ?? null, [items, activeId]);

  useEffect(() => () => items.forEach((item) => URL.revokeObjectURL(item.url)), [items]);
  useEffect(() => () => { if (batchUrl) URL.revokeObjectURL(batchUrl); }, [batchUrl]);

  function addFiles(files: File[]) {
    const accepted = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 20 * 1024 * 1024).slice(0, Math.max(0, 50 - items.length));
    const next = accepted.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setItems((current) => [...current, ...next]);
    if (!activeId && next[0]) setActiveId(next[0].id);
    setProcessedUrl(null);
    setQuality(null);
    setStatus(next.length ? `${next.length} image${next.length > 1 ? "s" : ""} added` : "No supported images selected");
  }

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDrag(false); addFiles(Array.from(event.dataTransfer.files));
  }

  function removeItem(id: string) {
    setItems((current) => {
      const target = current.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const next = current.filter((x) => x.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    setProcessedUrl(null); setQuality(null);
  }

  function applyCleanupResult(blob: Blob) {
    if (!active) return;
    const cleanedFile = new File(
      [blob],
      `${active.file.name.replace(/\.[^.]+$/, "")}-cleaned.png`,
      { type: "image/png" },
    );
    setItems((current) => current.map((item) => {
      if (item.id !== active.id) return item;
      URL.revokeObjectURL(item.url);
      return { ...item, file: cleanedFile, url: URL.createObjectURL(blob) };
    }));
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    setProcessedUrl(URL.createObjectURL(blob));
    setQuality(null);
    setStatus("Cleaned image ready for enhancement and export");
  }

  function applyPreset(name: string) {
    setPreset(name); setSettings((current) => ({ ...current, ...(presets[name] ?? {}) })); setProcessedUrl(null);
  }

  async function apiError(response: Response, fallback: string) {
    try { const body = await response.json(); return body.detail ?? fallback; } catch { return fallback; }
  }

  async function processOne() {
    if (!active) return;
    setBusy(true); setStatus("Processing selected image…");
    try {
      const body = new FormData(); body.append("file", active.file); body.append("options", JSON.stringify(settings));
      const response = await fetch(`${API_URL}/api/v1/process-image`, { method: "POST", body });
      if (!response.ok) throw new Error(await apiError(response, "Processing failed"));
      const blob = await response.blob();
      if (processedUrl) URL.revokeObjectURL(processedUrl);
      setProcessedUrl(URL.createObjectURL(blob));
      setStatus("Processed — validating output quality…");
      const qualityBody = new FormData();
      qualityBody.append("file", new File([blob], "pixelpro-result", { type: blob.type || "image/jpeg" }));
      qualityBody.append("deep", "false");
      const qualityResponse = await fetch(`${API_URL}/api/v1/quality-check`, { method: "POST", body: qualityBody });
      if (qualityResponse.ok) {
        const report: QualityReport = await qualityResponse.json();
        setQuality(report);
        const passed = report.resolution_ok && !report.blurry && !report.too_dark && !report.too_bright;
        setStatus(passed ? "Processed successfully — quality check passed" : "Processed — review quality indicators");
      } else {
        setStatus("Processed successfully");
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : "Processing failed"); } finally { setBusy(false); }
  }

  async function processBatch() {
    if (!items.length) return;
    if (items.length === 1) {
      await processOne();
      return;
    }
    setBusy(true); setStatus(`Processing ${items.length} images…`);
    try {
      const body = new FormData(); items.forEach((item) => body.append("files", item.file)); body.append("options", JSON.stringify(settings));
      const response = await fetch(`${API_URL}/api/v1/process-batch`, { method: "POST", body });
      if (!response.ok) throw new Error(await apiError(response, "Batch processing failed"));
      const blob = await response.blob();
      if (batchUrl) URL.revokeObjectURL(batchUrl);
      setBatchUrl(URL.createObjectURL(blob));
      setStatus("Batch ready — click Download Batch when you are ready");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Batch processing failed"); } finally { setBusy(false); }
  }

  async function runQualityCheck() {
    if (!active) return;
    setBusy(true); setStatus("Running image quality checks…");
    try {
      const body = new FormData(); body.append("file", active.file); body.append("deep", "false");
      const response = await fetch(`${API_URL}/api/v1/quality-check`, { method: "POST", body });
      if (!response.ok) throw new Error(await apiError(response, "Quality check failed"));
      const report: QualityReport = await response.json(); setQuality(report);
      const issues = [report.blurry && "blurry", !report.resolution_ok && "low resolution", report.too_dark && "too dark", report.too_bright && "too bright"].filter(Boolean);
      setStatus(issues.length ? `Quality check: ${issues.join(", ")}` : "Quality check passed");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Quality check failed"); } finally { setBusy(false); }
  }

  async function autoOptimize() {
    if (!active) return;
    setBusy(true); setStatus("PixelPro is analyzing the image…");
    try {
      const body = new FormData(); body.append("file", active.file); body.append("deep", "false");
      const response = await fetch(`${API_URL}/api/v1/quality-check`, { method: "POST", body });
      if (!response.ok) throw new Error(await apiError(response, "Analysis failed"));
      const report: QualityReport = await response.json(); setQuality(report);
      setSettings((current) => ({
        ...current,
        enhance_quality: true,
        white_balance: report.too_dark || report.too_bright ? true : current.white_balance,
        brightness: report.too_dark ? 1.08 : report.too_bright ? 0.96 : 1,
        sharpness: report.blurry ? 1.35 : 1.1,
        denoise_strength: report.blurry ? 3 : 0,
        upscale_factor: !report.resolution_ok ? 2 : 1,
      }));
      setStatus("Smart settings applied — preview with Process Image");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Auto optimize failed"); } finally { setBusy(false); }
  }

  async function analyzeReference(file: File) {
    setBusy(true); setStatus("Matching reference image…");
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch(`${API_URL}/api/v1/analyze-reference`, { method: "POST", body });
      if (!response.ok) throw new Error(await apiError(response, "Reference analysis failed"));
      const result = await response.json();
      setSettings((current) => ({ ...current, width: result.width, height: result.height, background: result.background, product_scale: result.product_scale, padding: result.padding, offset_x: result.offset_x, offset_y: result.offset_y }));
      setStatus("Reference look applied to settings");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Reference analysis failed"); } finally { setBusy(false); }
  }

  async function findDuplicates() {
    if (items.length < 2) { setStatus("Upload at least 2 images for duplicate detection"); return; }
    setBusy(true); setStatus("Scanning for duplicate images…");
    try {
      const body = new FormData(); items.forEach((item) => body.append("files", item.file)); body.append("threshold", "8");
      const response = await fetch(`${API_URL}/api/v1/find-duplicates`, { method: "POST", body });
      if (!response.ok) throw new Error(await apiError(response, "Duplicate scan failed"));
      const result = await response.json(); setStatus(result.duplicates.length ? `${result.duplicates.length} possible duplicate pair(s) found` : "No near-duplicates found");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Duplicate scan failed"); } finally { setBusy(false); }
  }

  function downloadPreview() {
    if (!processedUrl || !active) return;
    const ext = settings.output_format.toLowerCase().replace("jpeg", "jpg"); const a = document.createElement("a"); a.href = processedUrl; a.download = `${safeFileName(active.file.name.replace(/\.[^.]+$/, ""))}-pixelpro.${ext}`; a.click();
  }

  function downloadBatch() {
    if (!batchUrl) return;
    const a = document.createElement("a");
    a.href = batchUrl;
    a.download = "pixelpro-batch.zip";
    a.click();
  }

  const colors = [["White", "#FFFFFF"], ["Cream", "#F6F0E5"], ["Light Grey", "#ECECEC"], ["Black", "#111111"], ["Warm", "#EAD9C1"]];

  return (
    <div className="app">
      {cleanupOpen && active && <CleanupDialog item={active} onClose={() => setCleanupOpen(false)} onResult={applyCleanupResult}/>}
      <aside className="sidebar">
        <div className="brand"><div className="brandmark">P</div><div><h1>Pixel<span>Pro</span></h1><small>Image Studio</small></div></div>
        <div className="tagline">Perfect product images, <b>automatically.</b></div>
        <div className="navgroup"><button className="navitem active">⌂ Home</button><button className="navitem">＋ New Project</button><button className="navitem">▣ My Projects</button><button className="navitem">◈ Presets</button><button className="navitem">▤ Batch Process</button></div>
        <div className="navgroup"><div className="navlabel">Tools</div><button className="navitem" onClick={() => setSettings({ ...settings, remove_bg: true })}>◌ Background Remover</button><button className="navitem" onClick={() => setSettings({ ...settings, enhance_quality: true })}>✦ Image Enhancer</button><button className="navitem" onClick={() => setSettings({ ...settings, upscale_factor: 2 })}>↗ Upscaler</button><button className="navitem" disabled={!active} onClick={() => setCleanupOpen(true)}>◇ Watermark Remover</button><button className="navitem" onClick={() => setSettings({ ...settings, add_product_shadow: true })}>▱ Shadow Generator</button></div>
        <div className="procard"><h3>Free-first engine</h3><p>The core launch uses local open-source models and image processing. Paid APIs are not required.</p><button onClick={autoOptimize}>Smart Optimize</button></div>
      </aside>

      <main className="main">
        <div className="topbar"><div className="title"><h2>✨ AI Product Image Studio</h2><p>Turn raw product photos into consistent marketplace-ready assets.</p></div><div className="presetbar"><select value={preset} onChange={(e) => applyPreset(e.target.value)}><option value="pixelpro-square">PixelPro Square</option><option value="amazon-main">Amazon Main</option><option value="shopify-square">Shopify Square</option><option value="etsy-square">Etsy Square</option><option value="ebay-square">eBay Square</option><option value="walmart-square">Walmart Square</option><option value="social-square">Social 1:1</option><option value="social-portrait">Social 4:5</option></select><button onClick={() => referenceRef.current?.click()}>Match Reference</button><input ref={referenceRef} className="hiddeninput" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) analyzeReference(file); e.target.value = ""; }}/></div></div>

        <div className={`upload ${drag ? "drag" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
          <UploadCloud size={50} color="#173d33"/><h3>Upload <span>Your Images</span></h3><p>Select one image or a complete product catalog. All selected images can be processed together.</p>
          <label className="uploadbtn"><ImagePlus size={18}/> Choose Images<input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onFiles}/></label>
          <div className="chips"><span className="chip">JPG</span><span className="chip">PNG</span><span className="chip">WebP</span><span className="chip">20MB each</span><span className="chip">50 images / batch</span></div>
        </div>

        <section className="card previewcard">
          <div className="sectionhead"><h3>▧ Image Preview</h3><div className="inlineactions"><button className="ghost" disabled={!active || busy} onClick={runQualityCheck}><ScanSearch size={16}/> Quality Check</button><button className="ghost" disabled={!active || busy} onClick={autoOptimize}><Sparkles size={16}/> Auto Optimize</button><button className="ghost" onClick={() => { setProcessedUrl(null); setSettings(DEFAULTS); setQuality(null); }}>↻ Reset</button></div></div>
          <div className="previews"><div className="previewbox"><span className="badge">Original</span>{active ? <img src={active.url} alt="Original product"/> : <div className="empty">Upload images to begin</div>}</div><div className="previewbox"><span className="badge gold">Processed</span>{processedUrl ? <img src={processedUrl} alt="Processed product"/> : <div className="empty">Processed preview appears here</div>}</div></div>
          {quality && <div className="qualitystrip"><span className={quality.resolution_ok ? "pass" : "warn"}>Resolution {quality.resolution_ok ? "✓" : "!"}</span><span className={!quality.blurry ? "pass" : "warn"}>Sharpness {!quality.blurry ? "✓" : "!"}</span><span className={!quality.too_dark && !quality.too_bright ? "pass" : "warn"}>Exposure {!quality.too_dark && !quality.too_bright ? "✓" : "!"}</span><span>{quality.width} × {quality.height}</span></div>}
          <div className="toolbar">
            <label className="tool"><input type="checkbox" checked={settings.remove_bg} onChange={(e) => setSettings({ ...settings, remove_bg: e.target.checked })}/><Eraser size={20}/><div>Remove Background</div></label>
            <label className="tool"><input type="checkbox" checked={settings.enhance_quality} onChange={(e) => setSettings({ ...settings, enhance_quality: e.target.checked })}/><Sparkles size={20}/><div>Enhance Quality</div></label>
            <button className="tool" onClick={() => setSettings({ ...settings, offset_x: 0, offset_y: 0 })}><BoxSelect size={20}/><div>Center Product</div></button>
            <button className="tool" onClick={() => setSettings({ ...settings, upscale_factor: settings.upscale_factor > 1 ? 1 : 2 })}><Maximize2 size={20}/><div>Upscale {settings.upscale_factor > 1 ? `${settings.upscale_factor}×` : "Off"}</div></button>
            <button className="tool" disabled={!active} onClick={() => setCleanupOpen(true)}><Brush size={20}/><div>Watermark Remover</div></button>
            <label className="tool"><input type="checkbox" checked={settings.add_product_shadow} onChange={(e) => setSettings({ ...settings, add_product_shadow: e.target.checked })}/><Layers3 size={20}/><div>Add Shadow</div></label>
          </div>
        </section>

        <section className="card batch"><div className="sectionhead"><h3>Batch Images ({items.length})</h3><div className="inlineactions"><button className="ghost" disabled={busy || items.length < 2} onClick={findDuplicates}>Find Duplicates</button><button className="ghost" onClick={() => { items.forEach(x => URL.revokeObjectURL(x.url)); setItems([]); setActiveId(null); setProcessedUrl(null); setBatchUrl(null); setQuality(null); }}>Clear All</button></div></div><div className="thumbs"><button className="thumb" onClick={() => inputRef.current?.click()} aria-label="Upload more images">＋</button>{items.map((item) => <div className={`thumb ${active?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => { setActiveId(item.id); setProcessedUrl(null); setQuality(null); }}><img src={item.url} alt={item.file.name}/><button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>×</button></div>)}</div><div className="bottombar"><div><b>{items.length} Images Selected</b><div className="status">{status}</div></div><div className="actions"><button className="secondary" disabled={!processedUrl} onClick={downloadPreview}><Download size={16}/> Download Image</button>{batchUrl && <button className="secondary" onClick={downloadBatch}><Download size={16}/> Download Batch</button>}<button className="primary" disabled={!items.length || busy} onClick={processBatch}>{busy ? "Processing…" : items.length === 1 ? "✦ Process Image" : `✦ Process All (${items.length})`}</button></div></div></section>
      </main>

      <aside className="settings">
        <h3>☷ Edit & Preview</h3>
        <section className="panel"><h4>1. Background</h4><div className="colorgrid">{colors.map(([name, hex]) => <button key={hex} className={`colorbtn ${settings.background_style === "solid" && settings.background === hex ? "active" : ""}`} onClick={() => setSettings({ ...settings, background: hex, background_style: "solid", transparent_background: false })}><div className="swatch" style={{ background: hex }}/>{name}</button>)}<button className={`colorbtn ${settings.background_style === "transparent" ? "active" : ""}`} onClick={() => setSettings({ ...settings, background_style: "transparent", transparent_background: true, output_format: "PNG" })}><div className="swatch checker"/>Transparent</button></div><div className="field" style={{marginTop:10}}>Studio Style<select value={settings.background_style} onChange={(e) => { const style = e.target.value as BackgroundStyle; setSettings({ ...settings, background_style: style, transparent_background: style === "transparent" }); }}><option value="solid">Solid</option><option value="studio">Studio White</option><option value="soft-gray">Soft Gray Studio</option><option value="warm-studio">Warm Studio</option><option value="transparent">Transparent</option></select></div></section>
        <section className="panel"><h4>2. Output Size</h4><div className="fieldrow"><label className="field">Width<input type="number" min={256} max={6000} value={settings.width} onChange={(e) => setSettings({ ...settings, width: Number(e.target.value) })}/></label><label className="field">Height<input type="number" min={256} max={6000} value={settings.height} onChange={(e) => setSettings({ ...settings, height: Number(e.target.value) })}/></label></div><div className="field" style={{marginTop:9}}>Format<select value={settings.output_format} onChange={(e) => setSettings({ ...settings, output_format: e.target.value as Format })}><option>JPEG</option><option>PNG</option><option>WEBP</option></select></div></section>
        <section className="panel"><h4>3. Product Size</h4><div className="settingline"><span>Scale</span><b>{Math.round(settings.product_scale * 100)}%</b></div><input className="range" type="range" min="0.2" max="0.95" step="0.01" value={settings.product_scale} onChange={(e) => setSettings({ ...settings, product_scale: Number(e.target.value) })}/><div className="settingline mini"><span>Equal padding</span><b>{Math.round(settings.padding * 100)}%</b></div><input className="range" type="range" min="0" max="0.35" step="0.01" value={settings.padding} onChange={(e) => setSettings({ ...settings, padding: Number(e.target.value) })}/></section>
        <section className="panel"><h4>4. Manual Quality Controls</h4><label className="toggleline"><input type="checkbox" checked={settings.enhance_quality} onChange={(e) => setSettings({ ...settings, enhance_quality: e.target.checked })}/> Enable quality enhancement</label><label className="toggleline"><input type="checkbox" checked={settings.white_balance} onChange={(e) => setSettings({ ...settings, white_balance: e.target.checked })}/> Auto white balance</label><div className="settingline mini"><span>Brightness</span><b>{Math.round(settings.brightness * 100)}%</b></div><input className="range" type="range" min="0.7" max="1.3" step="0.01" value={settings.brightness} onChange={(e) => setSettings({ ...settings, brightness: Number(e.target.value) })}/><div className="settingline mini"><span>Contrast</span><b>{Math.round(settings.contrast * 100)}%</b></div><input className="range" type="range" min="0.7" max="1.5" step="0.01" value={settings.contrast} onChange={(e) => setSettings({ ...settings, contrast: Number(e.target.value) })}/><div className="settingline mini"><span>Color saturation</span><b>{Math.round(settings.saturation * 100)}%</b></div><input className="range" type="range" min="0" max="2" step="0.01" value={settings.saturation} onChange={(e) => setSettings({ ...settings, saturation: Number(e.target.value) })}/><div className="settingline mini"><span>Sharpness</span><b>{Math.round(settings.sharpness * 100)}%</b></div><input className="range" type="range" min="0.5" max="2.5" step="0.01" value={settings.sharpness} onChange={(e) => setSettings({ ...settings, sharpness: Number(e.target.value) })}/><div className="fieldrow" style={{marginTop:12}}><label className="field">Denoise<select value={settings.denoise_strength} onChange={(e) => setSettings({ ...settings, denoise_strength: Number(e.target.value) })}><option value="0">Off</option><option value="2">Light</option><option value="4">Medium</option><option value="7">Strong</option></select></label><label className="field">Upscale<select value={settings.upscale_factor} onChange={(e) => setSettings({ ...settings, upscale_factor: Number(e.target.value) })}><option value="1">Off</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></label></div><p className="footnote">Adjust controls, then click Process Image to preview the result.</p></section>
        <section className="panel"><h4>5. Shadow & Export</h4><label className="toggleline"><input type="checkbox" checked={settings.add_product_shadow} onChange={(e) => setSettings({ ...settings, add_product_shadow: e.target.checked })}/> Product shadow</label><div className="settingline mini"><span>Export quality</span><b>{settings.quality}%</b></div><input className="range" type="range" min="60" max="100" value={settings.quality} onChange={(e) => setSettings({ ...settings, quality: Number(e.target.value) })}/></section>
        <div className="process"><button className="primary" disabled={!active || busy} onClick={processOne}>✦ {busy ? "Working…" : "Process Image"}</button><button className="secondary" disabled={!processedUrl} onClick={downloadPreview}>↓ Download Sample</button><p className="footnote">Marketplace presets are editable starting points. Requirements can change; verify the marketplace before publishing.</p></div>
      </aside>
    </div>
  );
}
