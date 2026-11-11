# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Warehouse Smart Label Scanner — UI/UX & Frontend Implementation by Phase

**Version:** 1.0  
**Date:** 10 November 2026  
**Owner:** Product / UI-UX / Frontend  
**Status:** Implementation-ready draft; business assumptions require sign-off  
**Platform:** Responsive Web Application  
**Operational scale:** <100 boxes/day; standardized label template; database-backed

---

## 1. Executive Summary

Build a warehouse web application where operators (1) enter a box name/number and router type, (2) photograph/upload the box label, (3) have the system transcribe and structure label data, (4) review/correct and save it, then (5) either add another box or export a formatted Excel report matching the supplied example.

**Primary objective:** eliminate repetitive manual typing while preserving data correctness and producing a familiar warehouse report.

**Core principle:** OCR output is a draft, not inventory truth, until the operator confirms it. Each box belongs to one router model in the MVP; reports may combine multiple router models.

### 1.1 Inputs and expected output
- Input: `box_name` (e.g., `BOX 1`), `box_number` (e.g., `320080532609300063`), router model (`ROUTER OUTDOOR T3000` or `ROUTER OUTDOOR MC7500`), photo of label.
- Extraction: MAC address and/or serial numbers (SN), box metadata when present, and per-row pairing from the label.
- Intermediate result: editable structured preview with extraction warnings and duplication checks.
- Output: database records plus downloadable `.xlsx` report with model columns, box section headers and row-by-row values.

### 1.2 Example report observed in supplied screenshot
The reference shows a three-column grid:

| MAC AD | ROUTER OUTDOOR T3000 — SN | ROUTER OUTDOOR MC7500 — SN |
|---|---|---|
| *(blank)* | BOX 1_320080532609300063 | BOX 1_320101002609220242 |
| 5CFFA94CCCA8 | 324462875638 | 323962794243 |
| 5CFFA94CCCDA | 324462875688 | 323962794289 |
| 5CFFA94CCCD6 | 324462875684 | 323962794951 |
| 5CFFA94CCCD7 | 324462875685 | 323962794987 |
| *(blank)* | BOX 2_320080532609300064 | BOX 2_320101002609220243 |
| 5CFFA94CCCD1 | 324462875679 | 323962795011 |

**Critical ambiguity requiring sign-off:** the screenshot has only one `MAC AD` column, while two router-model SN columns are shown. It is not safe to assume the single MAC value belongs to both models. For MVP, every device must have an explicit model, box and MAC/SN relationship in the database. The report's shared MAC column is a *presentation format*; its meaning must be confirmed before production use. The UI must never fabricate a cross-model pairing. If a model has its own MAC addresses, use a model-specific MAC field in the canonical data and, if necessary, an alternate Excel layout.

---

## 2. Product Goals, KPIs & Non-Goals

### Goals
1. Process a box in a few clear steps without repeated typing.
2. Capture multiple devices from one label image.
3. Allow corrections and prevent incorrect data being silently saved.
4. Let the operator build a report incrementally across many boxes and router types.
5. Export Excel matching the reference template while preserving true record relationships.

### Initial KPI hypotheses (validate during pilot)
| Metric | Proposed target | Measurement |
|---|---:|---|
| Median time from upload to OCR preview | <=15 s on agreed test set | Client and server timestamps |
| Device MAC/SN correctness after review | >=99.9% | Audited confirmed records |
| Duplicate MAC/SN records inserted | 0 | Database constraints and tests |
| Export row completeness | 100% of selected confirmed records | Compare DB to workbook |
| Operator completion rate | >=95% for supported labels | Workflow analytics |

### Non-goals for MVP
- Native Android/iOS app, offline operation, ERP/WMS integration, support for arbitrary vendor labels, bulk upload of hundreds of images, and advanced BI dashboard.

---

## 3. Roles & Permissions

| Feature | Operator | Supervisor | Admin |
|---|---|---|---|
| Create session/report | Yes | Yes | Yes |
| Add/edit unsaved box | Yes | Yes | Yes |
| Upload, extract, review, confirm | Yes | Yes | Yes |
| View own/authorized report | Yes | Yes | Yes |
| Export confirmed records | Yes | Yes | Yes |
| Correct confirmed records | No | Yes, audited | Yes, audited |
| Manage users/templates | No | No | Yes |

All protected operations must be authorized by the backend; hiding buttons is not sufficient.

---

## 4. Information Architecture & Navigation

```text
Login
└── Warehouse Workspace
    ├── Reports / Sessions
    │   ├── New Report
    │   │   ├── Step 1: Add Box Details
    │   │   ├── Step 2: Capture / Upload Photo
    │   │   ├── Step 3: Extract / Review Data
    │   │   └── Step 4: Confirm Box
    │   │       ├── Add Another Box (returns to Step 1)
    │   │       └── Preview & Export Excel
    │   └── Report Detail / Resume
    ├── Scan History
    └── Settings (admin)
```

### Route map (Next.js App Router)
| Route | Screen | Access |
|---|---|---|
| `/login` | Login | Public |
| `/reports` | Report/session list | Authenticated |
| `/reports/new` | Create report | Authenticated |
| `/reports/[reportId]` | Report workspace & box list | Authenticated |
| `/reports/[reportId]/boxes/new` | Box details + photo capture | Authenticated |
| `/reports/[reportId]/scans/[scanId]/review` | OCR review | Authenticated |
| `/reports/[reportId]/export` | Report preview + download | Authenticated |
| `/history` | Scan history | Authenticated |
| `/settings` | System settings | Admin |

---

## 5. Core Workflow — Detailed Interaction Specification

### Step 1 — Enter Box
**Required:** router model, box name (`BOX 1`, `BOX 2`), box number.  
**Optional:** notes, label date.  
**UX:** prefill next box name (`BOX N+1`) within a report, but allow editing; keep `box_number` empty until supplied; searchable model dropdown.  
**Validation:** required fields, trim whitespace, max lengths, duplicate box number within database, and no collision in current report.  
**CTA:** `Continue to Photo`; secondary `Cancel`.

### Step 2 — Photograph / Upload Label
**Methods:** file picker, camera capture via `<input type="file" accept="image/*" capture="environment">` on supported devices, drag/drop on desktop.  
**Supported:** JPEG/PNG; suggested max 10 MB (configurable).  
**UX:** show thumbnail, replace/remove photo, upload progress, rotation/retry control.  
**Error:** invalid MIME, too large, corrupt file, unavailable camera, upload failure.  
**CTA:** `Scan Label`; disable until a valid image exists.

### Step 3 — AI/OCR Extraction and Review
**States:** uploading → processing → needs_review / ready / failed.  
**UI layout:** on desktop split view (photo left, editable fields/table right); on mobile photo collapsible above table.  
**Fields:** box name/number/model (entered manually, compare with extracted), quantity (if present), device rows: sequence, MAC, SN, confidence/status.  
**Validation:** 12-character hexadecimal MAC; SN model-specific rules; count matches quantity if label supplies quantity; duplicates against existing DB and within current report; field mismatch and ambiguous text highlighted.  
**Important:** Some labels may contain only SN or only MAC. If both are required by the selected report schema, do not silently fill missing values; require correction or explicitly mark as incomplete and block final export.  
**Actions:** `Rescan`, `Add Row`, `Delete Row`, `Save Draft`, `Confirm Box`. Confirm disabled if blocking errors remain. Show image crop/reference for low-confidence fields if supported.

### Step 4 — Confirm Box and Continue
After confirmation show a success summary: model, box name, box number, number of devices, scan timestamp.  
**Primary CTA:** `+ Add Another Box`.  
**Secondary CTA:** `Preview Excel / Download Excel`.  
**Tertiary:** `Back to Report`.

### Report Workspace
Show grouped list by model with box cards; statuses: draft, needs review, confirmed, exportable. Provide remove draft, resume draft, view confirmed box, and export. Export button enabled when >=1 confirmed box and all selected rows meet report rules. A report may remain open after export and later produce a new version.

---

## 6. Excel Output Specification (Reference-Aligned)

### 6.1 Reference-style layout
- Format: `.xlsx`, sheet name `Warehouse Report`.
- Header row 1: column A blank; B `ROUTER OUTDOOR T3000`; C `ROUTER OUTDOOR MC7500`.
- Header row 2: A `MAC AD` (may be vertically positioned/merged depending final template); B `SN`; C `SN`.
- Each box group begins with a header row: B `BOX 1_<T3000 box number>` and C `BOX 1_<MC7500 box number>`.
- Next four example rows contain one MAC value in A and SN values in B/C, matching the visual reference.
- Repeat for BOX 2, BOX 3, etc.; style: bold headings, centered SN, left-aligned MAC, black borders, white background, autosized widths, freeze panes, print settings.

### 6.2 Canonical vs display mapping
**Canonical database:** one device belongs to exactly one box and model; `mac_address` and `serial_number` belong to that device.  
**Reference report:** combines two model streams side-by-side, grouped by `box_name` and `unit_sequence`. Pairing side-by-side by row number is *visual alignment*, not evidence that those devices share a MAC.

**Decision gate EX-01:** confirm whether the single `MAC AD` column represents (a) a MAC common to both model columns, (b) MAC for T3000 only, or (c) a separate external MAC list. Until resolved, provide a **safe default normalized export** (one row per device with model, box, MAC, SN) and an **optional reference-style preview** with warnings. Do not publish a reference-style production report that implies unverified MAC associations.

### 6.3 Export options
1. `Normalized Inventory` (mandatory MVP): columns Report, Model, Box Name, Box Number, Unit No, MAC, SN, Confirmed At, Operator. Each confirmed device = one row.
2. `Reference Layout` (conditional MVP after EX-01 approval): matrix matching screenshot, with deterministic model/box/sequence alignment, blank cells where no value exists, no fabricated pairings.

### 6.4 Export edge cases
- Different counts between T3000 and MC7500: preserve extra rows and leave unmatched model cells blank.
- Box name exists for one model but not the other: show blank in missing model's header/rows.
- More than 2 models: choose a model-specific layout or split by sheets; do not silently truncate.
- Preserve all MAC/SN/box identifiers as **text cells**, never scientific notation or numeric coercion.
- Report version increments on each export; log exporter and timestamp.
- Excel formula injection: escape user-entered strings beginning with `=`, `+`, `-`, `@` before writing to workbook.

---

## 7. UI Design System

### Visual principles
- Operational, high-contrast, data-first, minimal decorative elements.
- Single primary CTA per screen, secondary action visually subordinate.
- Status never communicated by color alone; always include text/icon.
- Dense desktop tables, touch-friendly mobile controls.

### Design tokens (starting proposal)
| Token | Value |
|---|---|
| Primary | `#2563EB` |
| Success | `#15803D` |
| Warning | `#B45309` |
| Error | `#B91C1C` |
| Surface | `#FFFFFF` |
| Canvas | `#F8FAFC` |
| Text | `#0F172A` |
| Border | `#CBD5E1` |
| Font | Inter / system sans-serif |
| Radius | 8–12px |
| Spacing | 4px scale |

### Responsive breakpoints
- Mobile `<768px`: stacked layout; sticky bottom primary action; cards rather than wide table when needed.
- Tablet `768–1023px`: flexible grid, horizontally scrollable data table.
- Desktop `>=1024px`: split photo/review view, persistent summary sidebar.

### Accessibility
WCAG 2.2 AA target: labels, focus visibility, keyboard operation, clear error descriptions, sufficient contrast, non-color status, touch targets sized for mobile.

### Component inventory
`AppShell`, `TopBar`, `ReportHeader`, `ProgressStepper`, `BoxForm`, `ModelSelect`, `ImageUploader`, `ImagePreview`, `ScanStatus`, `EditableDeviceTable`, `ValidationBanner`, `ConfidenceIndicator`, `BoxSummaryCard`, `ReportBoxList`, `ExcelPreviewTable`, `ExportDialog`, `ConfirmDialog`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`.

---

## 8. Frontend Architecture

**Stack:** Next.js App Router, TypeScript strict mode, Tailwind CSS, accessible component primitives, React Hook Form + Zod, TanStack Query for server state, lightweight local state for unsaved UI, typed API client.

```text
src/
  app/
    (auth)/login/page.tsx
    (workspace)/reports/page.tsx
    (workspace)/reports/new/page.tsx
    (workspace)/reports/[reportId]/page.tsx
    (workspace)/reports/[reportId]/boxes/new/page.tsx
    (workspace)/reports/[reportId]/scans/[scanId]/review/page.tsx
    (workspace)/reports/[reportId]/export/page.tsx
    (workspace)/history/page.tsx
  components/
    ui/
    warehouse/
      box-form.tsx
      image-uploader.tsx
      extraction-review.tsx
      device-row-editor.tsx
      report-box-list.tsx
      excel-preview.tsx
  features/
    auth/
    reports/
    boxes/
    scans/
    exports/
  lib/
    api-client.ts
    schemas.ts
    formatters.ts
    errors.ts
  types/
    warehouse.ts
  tests/
    unit/
    integration/
    e2e/
```

### Client-state rules
- Server is source of truth after save; use TanStack Query for fetching and mutation cache invalidation.
- Preserve unsaved review edits while navigating accidentally; show leave-page warning.
- Never assume a scan is completed solely from an optimistic UI event.
- Poll scan status with bounded backoff (e.g. 2–5 seconds) until terminal state; cancel polling on unmount.
- For retryable requests, use idempotency keys and do not duplicate confirmed inventory.

### Example typed domain models
```ts
type RouterModel = 'ROUTER_OUTDOOR_T3000' | 'ROUTER_OUTDOOR_MC7500';
type ScanStatus = 'uploaded' | 'processing' | 'needs_review' | 'ready' | 'confirmed' | 'failed';

type DeviceDraft = {
  clientRowId: string;
  sequence: number;
  macAddress: string | null;
  serialNumber: string | null;
  confidence?: number;
  issues: string[];
};

type BoxDraft = {
  boxName: string;
  boxNumber: string;
  model: RouterModel;
  quantity: number | null;
  devices: DeviceDraft[];
};
```

### Suggested API contract (backend dependencies)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/reports` | Create report session |
| GET | `/api/v1/reports/:id` | Report and box summary |
| POST | `/api/v1/reports/:id/boxes/scans` | Submit box metadata + photo |
| GET | `/api/v1/scans/:id` | Poll OCR status and get draft |
| PATCH | `/api/v1/scans/:id/review` | Save reviewed draft |
| POST | `/api/v1/scans/:id/confirm` | Atomic inventory confirmation |
| GET | `/api/v1/reports/:id/export-preview` | Preview report matrix |
| POST | `/api/v1/reports/:id/exports` | Generate XLSX |
| GET | `/api/v1/exports/:id/download` | Download XLSX |

**API response:** structured `field_errors`, `warnings`, `duplicate_matches`, `scan_status`, `request_id`, and explicit `can_confirm`. Backend owns validation rules.

---

## 9. Data Model & Constraints

```text
users (id, name, email, role, password_hash, created_at)
reports (id, name, status, created_by, created_at, updated_at)
boxes (id, report_id, box_name, box_number, model, quantity, status, source_scan_id)
scan_jobs (id, report_id, box_draft_json, image_path, status, extracted_json, error, created_by, created_at)
devices (id, box_id, unit_sequence, mac_address, serial_number, confirmed_at)
exports (id, report_id, layout, version, file_path, exported_by, created_at)
audit_logs (id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at)
```

**Relationships:** report 1:N boxes; box 1:N devices; report 1:N scans/exports; scan may be associated with a confirmed box.  
**Constraints:** globally unique `box_number` (subject to business confirmation), unique `mac_address` and `serial_number` when present, unique `(box_id, unit_sequence)`, database transaction on confirmation, audit of confirmed edits. Null MAC/SN policy must be approved based on actual label content.

---

## 10. Phase-by-Phase Delivery Plan

### Phase 0 — Discovery & Data Contract (Week 1)
**Goal:** remove ambiguity before UI and export coding.

**Tasks:**
- Interview operator/supervisor; observe real process for 10–20 boxes.
- Collect 100–200 representative label images, with permission and redaction where needed.
- Confirm box naming, router model list, whether labels carry MAC/SN and how paired.
- Decide meaning of shared `MAC AD` column in screenshot (EX-01).
- Agree reference Excel template, blank-cell rules, box alignment, and minimum fields.
- Approve data dictionary, validation rules, roles, and success metrics.

**Deliverables:** signed-off PRD, sample set, Excel gold-standard, wireflow, domain schema, acceptance test fixtures.

**Exit criteria:** no unresolved ambiguity that could corrupt MAC/SN-to-model mapping; report format signed off.

### Phase 1 — Foundation, Design System & Report Shell (Week 2)
**Goal:** working navigable web shell.

**UI/UX tasks:** low/high fidelity screens, component states, responsive specifications, clickable prototype, usability review with 2–3 operators.

**Frontend tasks:** Next.js setup, TypeScript lint/format, Tailwind tokens, accessible components, auth integration, route protection, report list/create/workspace, loading/error/empty states.

**Deliverables:** design handoff and deployable UI shell with mock APIs.

**Acceptance criteria:** operator can log in, create/open report, navigate screens; mobile and desktop layout usable; unauthorized route blocked.

### Phase 2 — Box Form & Photo Capture (Week 3)
**Goal:** user can start a scan with a correctly identified box.

**UI/UX tasks:** box form, model selection, next-box prefill, camera/upload UX, upload progress and errors.

**Frontend tasks:** Zod form validation, file validation, image preview/replace, multipart upload, retry, server error mapping, draft persistence.

**Deliverables:** working `Add Box → Upload Photo → Scan Started` flow.

**Acceptance criteria:** missing box number blocked; duplicate box flagged; invalid files rejected; upload progress visible; request carries box/model metadata.

### Phase 3 — OCR Review & Confirmation (Week 4)
**Goal:** reliable editable transcription into database.

**UI/UX tasks:** side-by-side image/review, editable device rows, issue badges, error summary, success confirmation.

**Frontend tasks:** status polling, parse typed OCR response, row editor, inline validation, duplicate error UI, rescan/retry, confirm mutation, unsaved-change guard.

**Backend dependencies:** OCR/barcode processing, pairing, validation, unique constraints, atomic confirm.

**Deliverables:** end-to-end scan/review/save for one box.

**Acceptance criteria:** multiple MAC/SN rows shown; ambiguous fields highlighted; operator can correct; invalid or duplicate values cannot be confirmed; successful confirm persists all units exactly once.

### Phase 4 — Multi-Box Workspace & Excel Export (Week 5)
**Goal:** repeat scanning and produce the requested report.

**UI/UX tasks:** post-confirm two-CTA screen, grouped box list, export preview, format selection, download states.

**Frontend tasks:** add another box with sequential name suggestion, report summary query, preview matrix, download action, export error handling.

**Backend dependencies:** report grouping, deterministic Excel generation, normalized export and approved reference layout, export history.

**Deliverables:** `Confirm → Add Another Box OR Download Excel` workflow.

**Acceptance criteria:** adding 3 boxes preserves prior boxes; cross-model grouping matches approved template; missing values remain blank; downloaded workbook opens correctly; all identifiers preserved as text.

### Phase 5 — QA, UAT, Pilot & Release (Week 6)
**Goal:** safe operational launch.

**Tasks:** unit/integration/E2E tests, OCR benchmark, accessibility audit, browser/mobile QA, security tests, 1-week pilot or agreed representative shift, operator training, rollback and monitoring.

**Deliverables:** QA report, UAT sign-off, release checklist, runbook, operator guide.

**Exit criteria:** no critical defects, export reconciles with database, accuracy and workflow KPIs reviewed, backup/recovery verified, owner approves go-live.

---

## 11. User Stories & Acceptance Criteria

### US-01 — Create report
**As an** operator, **I want** to create a report session **so that** related boxes can be exported together.
- Given authenticated operator, when entering report name and submitting, then a unique report is created.
- Empty name produces inline error; report remains accessible after page reload.

### US-02 — Enter box identity
**As an** operator, **I want** to enter box name, number and model before photographing.
- Required fields are validated client and server side.
- Suggested next box name can be overwritten.
- Existing box number is rejected with a useful error.

### US-03 — Capture label
**As an** operator, **I want** to use camera or file upload.
- JPEG/PNG accepted; invalid type/oversized file rejected.
- Preview and replace available before scan.
- Upload failure offers retry without re-entering metadata.

### US-04 — Review extracted rows
**As an** operator, **I want** to inspect/edit OCR data rather than type all rows.
- All extracted rows are displayed with MAC/SN sequence.
- Each row can be edited; warnings are visible and keyboard accessible.
- Blank/uncertain fields are never silently populated.

### US-05 — Prevent duplicates
**As an** operator, **I want** to know if box, MAC or SN already exists.
- Duplicates detected across current draft/report/database.
- Server prevents duplicate confirmation under concurrent requests.
- Conflict displays existing record reference when authorized.

### US-06 — Confirm box
**As an** operator, **I want** to save a reviewed box once.
- Confirm disabled on blocking validation errors.
- Save is atomic and idempotent.
- Confirmation shows box and device counts; retry does not duplicate.

### US-07 — Add another box
**As an** operator, **I want** to keep scanning boxes in the same report.
- After confirmation, `Add Another Box` returns to box form.
- Report context persists; previously saved boxes remain visible.
- Number suggestion advances within the report.

### US-08 — Preview and export Excel
**As an** operator, **I want** to download a familiar spreadsheet.
- Preview shows grouped models and boxes.
- Normalized Excel always available for valid confirmed data.
- Reference layout enabled only after mapping approval.
- Download contains all selected confirmed rows with no data coercion.

### US-09 — Resume interrupted work
**As an** operator, **I want** to resume drafts after connection interruption.
- Report and scan status reload from backend.
- Draft edits can be restored when saved.
- Clear distinction between draft and confirmed records.

### US-10 — Supervisor correction
**As a** supervisor, **I want** to correct confirmed records with traceability.
- Operator cannot edit confirmed records.
- Authorized correction requires reason and writes audit log.
- New exports reflect corrected records and carry version/timestamp.

---

## 12. Error, Empty & Loading State Matrix

| Scenario | UI response | Recovery |
|---|---|---|
| No reports | Empty state + Create Report CTA | Create report |
| No boxes in report | Prompt to add first box | Add box |
| Upload in progress | Progress bar, disable double submit | Wait/cancel if supported |
| OCR running | Stepper/skeleton + elapsed indicator | Poll status |
| OCR timed out | Error with scan ID | Retry scan |
| Unreadable photo | Low-quality warning | Replace/rescan |
| Quantity mismatch | Blocking row count message | Correct rows/quantity |
| Duplicate MAC/SN | Inline error + reference | Correct or investigate |
| Connection lost | Non-destructive retry banner | Retry |
| Export empty | Disabled CTA + explanation | Confirm box |
| Export failure | Error toast + retry | Regenerate export |
| Unsaved edits | Leave-page confirmation | Save draft/discard/stay |

---

## 13. Quality Assurance & Testing

### Unit tests
- Box name suggestion, field validation, MAC normalization, duplicate row detection, export preview grouping, safe identifier formatting.

### Integration tests
- Form submit and API errors, upload flow, scan polling, review save, confirm conflict, report refresh, export download.

### End-to-end tests (Playwright)
1. Login → create report → add T3000 box → upload → review four devices → confirm.
2. Add MC7500 box → confirm → preview → export.
3. Quantity mismatch blocks confirm.
4. Duplicate box/MAC/SN blocks confirm.
5. OCR failure → retry successfully.
6. Refresh during review → restore persisted draft.
7. Mobile camera/file upload fallback.
8. Excel opens, has expected headers, box sections, and exact text identifiers.

### Accessibility tests
Keyboard-only path, screen-reader field names, focus management on dialogs/errors, color contrast, zoom at 200%, responsive tables.

### Performance tests
Upload ~10 MB images on representative warehouse connectivity; median/95th percentile scan latency; <=100 boxes/day; no browser freeze when report contains hundreds of rows.

---

## 14. Definition of Ready / Done

### Definition of Ready
- User story has approved acceptance criteria.
- Figma design and all states documented.
- API schema/mock response available.
- Error cases and test data available.
- Dependencies and security rules understood.

### Definition of Done
- UI matches approved design and responsive states.
- TypeScript, lint, and automated tests pass.
- API integrated with loading/error/retry handling.
- Keyboard accessibility and role checks verified.
- QA/UAT acceptance criteria passed.
- Technical documentation and release notes updated.

---

## 15. Risks, Assumptions & Open Decisions

| ID | Item | Proposed handling | Owner |
|---|---|---|---|
| EX-01 | Meaning of shared `MAC AD` in two-model screenshot | Confirm before reference-style export | Warehouse owner |
| EX-02 | Are box labels always same template? | Collect diverse samples and define supported template | BA/OCR engineer |
| EX-03 | Is MAC present for MC7500? | Confirm per-model required fields | Warehouse owner |
| EX-04 | Must quantity always be 4? | Treat as variable, validate label count | BA |
| EX-05 | Global uniqueness of box number | Validate business scope | BA/Backend |
| EX-06 | Retention period for label images | Agree security/retention policy | Admin |
| EX-07 | Cloud vs on-prem OCR | Benchmark accuracy, latency, data privacy, cost | Tech lead |
| EX-08 | Report grouping when box numbering differs across models | Align by explicit box label; never assume same physical box | Warehouse owner |
| EX-09 | What to do with SN-only labels | Block canonical completion or approve nullable MAC policy | BA |
| EX-10 | Exact Excel style, merged headers, printing | Approve golden workbook | Warehouse owner |

**Risk controls:** human review, OCR confidence and cross-checks, database unique constraints, idempotent writes, permission checks, audit logging, and export reconciliation.

---

## 16. Handoff Checklist by Discipline

### UI/UX Designer
- [ ] User flow and task analysis approved
- [ ] Desktop/mobile wireframes for all 7 core screens
- [ ] High-fidelity Figma components and states
- [ ] Editable table interaction and photo zoom specification
- [ ] Error/empty/loading/disabled/confirmation states
- [ ] Accessibility annotations and responsive handoff
- [ ] Excel preview aligned with approved workbook

### Frontend Developer
- [ ] Next.js/TypeScript project initialized
- [ ] Auth + protected routes
- [ ] Report/session state and API client
- [ ] Box form with validation
- [ ] Camera/file uploader and preview
- [ ] OCR polling and editable review table
- [ ] Confirm, duplicate handling, idempotency
- [ ] Add another box and grouped report workspace
- [ ] Excel preview and download
- [ ] Automated tests, logging, deployment checks

### Backend / AI Engineer (Dependencies)
- [ ] OCR/barcode extraction API and sample outputs
- [ ] Confidence/issue schema and error contracts
- [ ] Pairing logic and quantity checks
- [ ] Transactional inventory save with uniqueness constraints
- [ ] Report aggregation and deterministic XLSX generator
- [ ] Auth/RBAC, image storage, audit, backup

---

## 17. Release Criteria and Success Evaluation

MVP can be released when the warehouse owner approves the sample Excel layout and MAC interpretation, operators complete the full flow on real photos, duplicate prevention and data reconciliation tests pass, and there are no unresolved severity-1 defects.

**Post-launch measurement:** collect baseline and actual time/box, correction rate, failed scans, export counts, duplicate prevention events, and operator feedback for 2–4 weeks. Prioritize future improvements based on measured friction, not feature count.

---

## 18. Recommended Next Artifacts

1. Figma wireframes and high-fidelity UI for the screens in Section 4.
2. OpenAPI contract + JSON examples for each scan state.
3. Approved `.xlsx` golden template and 10 sample exports for verification.
4. Sprint backlog with story points, owners, and dependencies.
5. Test dataset manifest linking each label photo to verified expected MAC/SN data.

**Document status:** Draft ready for stakeholder review. The report's shared MAC column (EX-01) is the primary unresolved business rule and must be resolved before final reference-layout export implementation.
