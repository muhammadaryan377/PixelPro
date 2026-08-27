# PixelPro Automotive

PixelPro Automotive is a catalog-image operations platform for automotive parts sellers, distributors, dismantlers, dealership groups and ecommerce teams.

It turns inconsistent supplier or warehouse product photos into a repeatable catalog package:

```text
raw automotive images
        ↓
background cleanup
        ↓
part centering + scale normalization
        ↓
automotive catalog preset
        ↓
quality checks + possible duplicate detection
        ↓
processed images + CSV manifest + batch report
```

This branch is the commercial automotive V1:

`feat/automotive-commerce-platform`

## Product positioning

PixelPro is not positioned as a generic photo editor. The product is designed around a painful catalog-operations workflow: automotive teams receiving many inconsistent product images from suppliers, warehouses or dismantled vehicles and needing a consistent ecommerce standard.

### Target customers

- Automotive parts ecommerce stores
- Parts distributors and wholesalers
- Vehicle dismantlers / used-parts sellers
- Dealership groups
- Marketplace sellers
- Catalog-management agencies

## Commercial V1 features

### Customer product

- Automotive landing page
- Signup and login
- Company workspaces
- Monthly usage tracking
- Processing job history
- Responsive automotive Catalog Studio
- Trial / Starter / Business / Agency pricing model

### Automotive Catalog Studio

- Up to 200 images per catalog batch by default
- JPG, PNG and WEBP input
- Automotive-specific image presets
- Background removal
- Product centering
- Repeatable margins / product occupancy
- White, blue and soft-studio outputs
- Optional custom background override
- Quality enhancement
- Product-scale control
- SKU extraction from supplier filenames
- Fallback SKU prefixes
- Safe output filenames
- Quality audit
- Possible near-duplicate flagging with perceptual hashes
- Batch ZIP export
- `catalog-manifest.csv`
- `batch-report.json`
- Per-file failure handling so one bad image does not destroy a complete batch

### Existing PixelPro image engine retained

- Background removal using `rembg`
- Pillow composition and export
- OpenCV quality analysis
- JPEG / PNG / WEBP
- Single image processing
- Generic batch processing
- Reference-image analysis
- Duplicate detection
- Manual mask cleanup
- Optional Groq Vision assisted overlay detection

> PixelPro should only process imagery the customer owns or is authorized to edit. Genuine manufacturer labels, product tags, part numbers and physical product markings should be preserved unless the catalog owner intentionally chooses otherwise.

## Automotive presets

| Preset | Purpose | Output |
| --- | --- | --- |
| `auto-white-1600` | General marketplace/catalog starting point | 1600×1600 JPEG |
| `auto-blue-1024` | Dealer/internal blue catalog | 1024×1024 JPEG |
| `auto-studio-1600` | Premium neutral product page | 1600×1600 JPEG |
| `auto-shopify-2048` | Large web-commerce asset | 2048×2048 WEBP |

Marketplace requirements can change. These are editable production starting points, not compliance guarantees.

## Architecture

```text
Next.js 15 / React 19
│
├── Marketing site
├── Pricing
├── Signup / login
└── Automotive Catalog Studio
          │
          ▼
FastAPI
│
├── account + session API
├── usage + job API
├── automotive catalog API
├── image pipeline
│   ├── rembg / ONNX
│   ├── Pillow
│   └── OpenCV / NumPy
│
└── SQLite commercial-V1 store
    ├── users
    ├── sessions
    ├── usage_events
    └── jobs
```

For local and single-instance deployments SQLite keeps the product simple. Before multi-instance production, move the persistence layer to PostgreSQL and long-running image jobs to a worker queue.

## Repository layout

```text
apps/
  api/
    app/
      main.py
      automotive.py
      platform_store.py
      routes_automotive.py
      routes_platform.py
      services/
  web/
    app/
      page.tsx
      login/page.tsx
      dashboard/page.tsx
      pricing/page.tsx
      components/SiteNav.tsx
.github/workflows/ci.yml
```

## Run locally

### Docker

Copy the environment example:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Then:

```bash
docker compose up --build
```

Open:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

Docker persists workspace data in the `pixelpro-data` volume and rembg models in `rembg-models`.

### Lower-memory Docker build

If Docker Desktop is memory constrained, build services one at a time:

```powershell
$env:COMPOSE_PARALLEL_LIMIT="1"
docker compose build api
docker compose build web
docker compose up
```

## API

### Platform

- `GET /health`
- `GET /api/v1/features`
- `GET /api/v1/plans`
- `POST /api/v1/account/signup`
- `POST /api/v1/account/login`
- `GET /api/v1/account/me`
- `GET /api/v1/account/usage`
- `GET /api/v1/jobs`

Authenticated endpoints use:

```text
Authorization: Bearer <session-token>
```

### Automotive

- `GET /api/v1/automotive/profile`
- `GET /api/v1/automotive/presets`
- `POST /api/v1/automotive/roi`
- `POST /api/v1/automotive/audit`
- `POST /api/v1/automotive/process-catalog`

### Core image engine

- `GET /api/v1/presets`
- `POST /api/v1/process-image`
- `POST /api/v1/process-batch`
- `POST /api/v1/cleanup`
- `POST /api/v1/auto-watermark-removal`
- `POST /api/v1/quality-check`
- `POST /api/v1/analyze-reference`
- `POST /api/v1/find-duplicates`

## Catalog ZIP contract

A successful automotive catalog batch downloads a ZIP shaped like:

```text
pixelpro-job_<id>.zip
├── images/
│   ├── sku-001-pixelpro.jpg
│   ├── sku-002-pixelpro.jpg
│   └── ...
├── catalog-manifest.csv
└── batch-report.json
```

The manifest contains original filename, derived SKU, vendor, preset, processing status, output filename, possible duplicate reference, image dimensions, sharpness, resolution status and notes.

## Pricing model in the UI

The commercial V1 currently presents a validation pricing model:

- Trial — 250 images/month
- Starter — $49/month, 1,000 images
- Business — $149/month, 5,000 images
- Agency — $399/month, 20,000 images

These numbers are deliberately configurable. Before public launch, validate willingness to pay and measure actual compute/storage/support cost. Do not represent modeled ROI as customer-proven savings until real customer data exists.

## What is complete vs what still blocks a serious public launch

### Implemented now

- End-to-end customer account flow
- Company workspace
- Automotive-specific UI and positioning
- Automotive batch processing
- Catalog export contract
- Usage and job persistence
- Responsive pricing and marketing UI
- CI for Python tests and Next.js production build

### Next production hardening

1. PostgreSQL instead of SQLite for multi-instance deployment.
2. Redis / queue workers so large catalog jobs are asynchronous and resumable.
3. S3-compatible object storage with signed uploads/downloads.
4. Email verification, password reset and optional SSO.
5. Real billing provider integration only after pricing validation.
6. Organization roles and team invitations.
7. Rate limits, per-plan quota enforcement and API keys.
8. Structured logging, metrics, tracing and error monitoring.
9. Antivirus/content validation and stricter upload security.
10. Shopify / WooCommerce / PIM integrations based on customer demand.
11. Production marketplace profiles versioned against current rules.
12. A customer-backed benchmark dataset for auto-part segmentation and catalog QA.

## Sale / acquisition readiness

A strategic buyer should be able to understand and transfer:

- Product positioning
- Source code
- Customer workflow
- API contract
- Processing pipeline
- Pricing model
- Deployment configuration
- Tests / CI
- Usage and job data model
- Remaining production roadmap

The strongest acquisition value will come from real customer traction, recurring revenue, retention, processing volume, measured unit economics and clean transferable IP — not source code alone.
