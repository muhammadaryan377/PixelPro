# PixelPro Automotive — Acquisition Readiness

This document describes how PixelPro Automotive should be prepared for a strategic software acquisition or full IP/source-code transfer.

## 1. What the buyer is acquiring

A complete acquisition can include, subject to the final purchase agreement:

- PixelPro source code and repository history
- Automotive Catalog Studio web application
- FastAPI backend and image-processing pipeline
- Commercial account, plan, quota, usage and job models
- Automotive catalog presets and versioned marketplace profiles
- Docker and deployment configuration
- Automated tests and CI workflow
- Product documentation and API contract
- Brand, domain and design assets only if specifically listed in the agreement and owned by the seller
- Customer contracts and operational data only where legally transferable and explicitly included

Third-party software, models, APIs and services remain governed by their own licenses and terms. They must be listed separately during due diligence and are not automatically transferred as seller-owned IP.

## 2. Current commercial V1

PixelPro Automotive currently provides an end-to-end early-customer workflow:

1. Company signup/login
2. Company workspace
3. Plan-aware monthly image quota and batch limits
4. Supplier or warehouse image upload
5. Automotive catalog preset selection
6. Background cleanup and product normalization
7. SKU-safe filename generation
8. Quality audit
9. Possible duplicate detection
10. Batch processing
11. ZIP export with processed images
12. CSV catalog manifest
13. JSON batch report
14. Usage accounting
15. Processing job history

The product is suitable for demos, controlled pilots and early customers on a single application deployment.

## 3. What a serious buyer will verify

A buyer should be given evidence for:

### Product

- Live demo using a representative automotive image batch
- Repeatable output quality across different part categories
- Error behavior for unsupported/corrupt/low-quality files
- Customer authorization and image-rights workflow
- Current marketplace-profile verification date

### Engineering

- Git history and ownership
- CI status
- Test suite
- Dependency inventory and licenses
- Environment configuration
- Deployment instructions
- Data schema
- Session/authentication model
- Quota enforcement
- Failure handling

### Business

- Paying customer count
- MRR / ARR
- Gross margin
- Monthly image volume
- Cost per processed image
- Retention / churn
- Support load
- Customer concentration
- Pipeline of prospective customers

Do not invent these metrics. Store and report only measured values.

## 4. Production hardening before broad public launch

The commercial V1 deliberately keeps infrastructure simple. For multi-tenant production at meaningful scale, complete these items:

1. Move persistent data from SQLite to PostgreSQL.
2. Move long-running catalog jobs to a durable queue and worker fleet.
3. Store uploads/outputs in S3-compatible object storage using signed URLs.
4. Make large jobs asynchronous, resumable and idempotent.
5. Add email verification, password reset and optional SSO.
6. Add organization roles, team invitations and audit logs.
7. Add API keys and per-plan API rate limits.
8. Connect a billing provider only after pricing and unit economics are validated.
9. Add structured logs, metrics, traces and centralized error monitoring.
10. Add backup, restore and disaster-recovery procedures.
11. Add malware/file validation and stricter content security controls.
12. Create a customer-backed automotive benchmark set for segmentation and QA.

## 5. IP and licensing due diligence

Before signing an acquisition agreement, produce a dependency and rights schedule covering:

- npm packages
- Python packages
- rembg / ONNX models
- optional Groq API usage
- optional future AI/model providers
- icons and design assets
- fonts, if any are added later
- marketplace names/logos used in product copy
- customer-provided images and datasets

PixelPro should not represent third-party open-source software or marketplace standards as seller-owned IP.

## 6. Customer data transfer

If the business has customers when it is sold:

- Review the privacy policy and customer contracts.
- Determine whether account, usage and job metadata may be transferred.
- Do not transfer customer images unless the agreement and applicable privacy/data terms allow it.
- Rotate secrets and credentials during handover.
- Provide an export of only the data explicitly included in the transaction.

## 7. Handover package

A clean buyer handover should contain:

```text
PixelPro acquisition package
├── source repository
├── release tag / acquisition commit
├── environment-variable inventory
├── deployment runbook
├── architecture overview
├── API contract
├── database migration/export procedure
├── dependency + license inventory
├── marketplace-profile verification notes
├── customer/financial metrics package
├── known issues / roadmap
└── credential-rotation checklist
```

## 8. Acquisition value drivers

Source code alone is not the strongest valuation story. The most important value drivers are:

- Real automotive customers
- Recurring revenue
- High monthly catalog volume
- Low customer churn
- Reliable processing quality
- Measured labor/time savings
- Healthy unit economics
- Low founder dependency
- Clean code and documentation
- Transferable contracts and IP
- Strategic integrations with ecommerce/PIM/catalog workflows

## 9. Recommended exit preparation

Before actively targeting a large strategic acquisition:

- Obtain at least several real automotive pilot customers.
- Measure image volume, processing cost and support effort.
- Build customer case studies with permission.
- Track recurring revenue and retention for multiple months.
- Keep marketplace profiles versioned and re-verify them periodically.
- Create a buyer data room containing financial, technical and legal evidence.
- Keep a release branch/tag that exactly matches the product being demonstrated to buyers.

This document is an operational checklist, not legal or valuation advice. Final IP transfer, representations, warranties and customer-data treatment should be documented in the signed acquisition agreement.
