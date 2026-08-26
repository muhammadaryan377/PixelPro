# PixelPro

PixelPro is a free-first product-image automation platform for e-commerce sellers, marketplace teams, catalog operations and creators.

## Product promise

Upload one image or a complete product catalog and turn inconsistent raw photos into clean, consistent, marketplace-ready assets.

## Launch feature set

- Multi-image upload and batch ZIP export
- Background removal with `rembg`
- Product centering and equal spacing
- Aspect-ratio-safe smart resize
- Solid, transparent and procedural studio backgrounds
- Basic quality enhancement, white balance and denoise
- CPU smart upscale in the core build
- Product shadow generation
- Manual brush-mask object / mark cleanup using OpenCV inpainting
- JPEG, PNG and WebP conversion + compression controls
- Marketplace-oriented editable presets
- Reference-image matching: copy canvas size, product occupancy, background estimate and positioning from a good example
- Image quality checks: blur, resolution and exposure; optional deeper product-margin checks
- Near-duplicate detection using perceptual hashes
- Automatic settings suggestions with Auto Optimize

> Marketplace rules change. PixelPro presets are editable starting points, not a compliance guarantee. Always verify the current rules of the target marketplace before publishing.

## Free-first model strategy

The default launch build does not call paid image APIs.

```text
Background removal  -> rembg / ONNX
Resize/composition   -> Pillow
Image analysis       -> OpenCV + NumPy
Cleanup/inpainting   -> OpenCV mask inpainting
Batch/export         -> Python ZIP + Pillow
Quality/duplicates   -> OpenCV rules + perceptual hash
```

Optional local-AI upgrades are kept separate so CPU users can still run PixelPro:

- Real-ESRGAN for higher-quality local super-resolution
- LaMa for stronger masked cleanup / restoration
- Hugging Face Diffusers for optional local generative backgrounds and inpainting

These projects are open-source, but running GPU workloads still has compute cost if PixelPro is deployed on paid cloud hardware.

## Architecture

```text
Next.js web app
      |
      v
FastAPI image API
      |
      +-- image pipeline
      |     +-- rembg
      |     +-- Pillow
      |     +-- OpenCV
      |
      +-- intelligence
      |     +-- quality checks
      |     +-- reference matching
      |     +-- duplicate detection
      |     +-- smart setting suggestions
      |
      v
single image / batch ZIP
```

## Repository

```text
apps/
  web/       Next.js UI
  api/       FastAPI image-processing service
.github/
  workflows/ CI
```

## Run locally

### Docker

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

### Without Docker

API:

```bash
cd apps/api
python -m venv .venv
# activate the environment
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Web:

```bash
cd apps/web
npm install
npm run dev
```

The first background-removal request downloads the selected open-source rembg model and caches it locally.

## API

- `GET /health`
- `GET /api/v1/features`
- `GET /api/v1/presets`
- `POST /api/v1/process-image`
- `POST /api/v1/process-batch`
- `POST /api/v1/cleanup`
- `POST /api/v1/quality-check`
- `POST /api/v1/analyze-reference`
- `POST /api/v1/find-duplicates`

## What "industry level" means for the next production phase

The current branch is the launch-quality processing foundation. Before serving high traffic we should add:

1. PostgreSQL for users, projects, presets, jobs and audit records.
2. Redis + worker queue for long batch and GPU jobs.
3. S3-compatible object storage instead of keeping uploads on an app server.
4. Authentication, team workspaces, quotas and rate limiting.
5. Billing only after real user validation; the image engine itself remains free-first.
6. Structured logging, Sentry/OpenTelemetry, metrics and job traces.
7. Antivirus/content validation, stricter file decoding limits and signed downloads.
8. Real-ESRGAN provider with CPU fallback.
9. LaMa provider for high-quality cleanup with OpenCV fallback.
10. Optional local Diffusers provider for generative backgrounds.
11. Marketplace QA profiles with versioned rules and test fixtures.
12. Shopify / WooCommerce / marketplace integrations only after the core workflow is stable.

## Safety / intended use

Object or mark cleanup is for images the user owns or is authorized to edit. PixelPro should preserve product identity, branding, materials, labels and dimensions unless the user explicitly chooses an allowed transformation.
