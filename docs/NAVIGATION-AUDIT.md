# Kohl CRM navigation and feature audit

Reviewed 2026-10-25 against local source snapshot, commit `edf252d`.

Implementation follow-up: the local update is described in [WORKSPACE-NAVIGATION-UPDATE.md](WORKSPACE-NAVIGATION-UPDATE.md). The findings and baseline results below describe the app before that update.

## Conclusion and scope

The app already has 16 sidebar destinations. Its main navigation problem is a flat list with long labels and important workflows hidden in page tabs. Reorganizing existing destinations can improve browsing without changing the data model. New business modules are a separate project.

This is a source review, not a live production or authenticated browser audit. No application source, database, permissions, production configuration, or deployment was changed for this review. The source export documents its production origin; parity with the currently running app has not been independently established.

## Recommended structure: six labeled groups

Keep the dashboard directly accessible. On desktop, initially show labeled sections with all permitted links visible. Optional collapsing can follow; the group containing the current page must open automatically. On mobile, retain the existing drawer and tile presentation with group headings. Avoid a second level of expanding submenus in the first release.

Every existing destination is retained exactly once:

| Group | Suggested short label | Existing URL | Existing permission key |
| --- | --- | --- | --- |
| الرئيسية | لوحة التحكم | `/dashboard` | `dashboard` |
| العقارات والأملاك | الخريطة العقارية | `/property-map` | `ownership-properties` |
| العقارات والأملاك | العقارات والملكية | `/ownership-properties` | `ownership-properties` |
| العقارات والأملاك | إدارة الأملاك | `/property-management` | `property-management` |
| العقود والخدمات | العقود والإيجارات | `/contracts` | `contracts` |
| العقود والخدمات | اتفاقيات الوساطة | `/brokerage-agreements` | `brokerage-agreements` |
| العقود والخدمات | الخدمات والمعاملات | `/general-services` | `general-services` |
| العملاء والمبيعات | علاقات العملاء | `/crm` | `crm` |
| العملاء والمبيعات | طلبات العملاء | `/customer-orders` | `customer-orders` |
| العملاء والمبيعات | بوابات العملاء | `/portal-management` | `portal-management` |
| المالية والتقارير | الأرباح والمعاملات | `/financials/earnings` | `financials` |
| المالية والتقارير | الفواتير والسندات والنماذج | `/bills-forms` | `bills-forms` |
| المالية والتقارير | التقرير اليومي | `/financials/daily-reports` | `daily-reports` |
| الإدارة والوثائق | الموظفون والرواتب | `/employees` | `employees` |
| الإدارة والوثائق | المستخدمون والصلاحيات | `/users-access` | `users-access` |
| الإدارة والوثائق | الأرشيف والوثائق | `/archive` | `archive` |

The original page titles can remain descriptive. Group placement conveys subject matter, not authorization: for example, putting portal management beside CRM must not grant employees access to it.

### Other viable layouts

1. **Labeled sections, all open:** easiest transition and least new interaction logic. Recommended first release.
2. **Collapsible sections:** shorter sidebar, with remembered group state and automatic expansion of the current destination. More keyboard and mobile behavior to verify.
3. **Favorites plus grouped sections:** best later enhancement for different staff roles. Keep the full navigation available and reapply permissions to saved favorites.

Keep the ivory/gold tokens, consistent right-aligned icons, existing active-page stripe, and clear keyboard focus. Remove decorative link chevrons that imply expansion; use chevrons only on actual group toggles. Avoid hardcoded “new” badges that never expire. Existing desktop account footer behavior is already fixed while the upper area scrolls; preserve it.

## Existing features that should not be rebuilt

| Capability | Existing location | Recommendation |
| --- | --- | --- |
| Owners, tenants, deeds, representatives, electronic powers of attorney | Ownership page: `properties`, `documents`, `epoa`, `lessors`, `tenants`, `representatives` tabs | Keep together; later offer validated tab shortcuts. |
| Ownership change history | Ownership page: `audit` tab | Improve discovery; do not label it as a complete system audit. |
| Pipeline, deals, calls/WhatsApp follow-ups, property matching | CRM: `pipeline`, `deals`, `activities`, `matcher` tabs | Keep CRM as the workflow owner. |
| Operating maintenance and owner statements | Property management: `CONTRACTS`, `MAINTENANCE`, `STATEMENTS` tabs | Expose shortcuts only after those tabs support URL selection. |
| Tenant/owner maintenance approvals, scheduled visits, attachments | Executive portal management: maintenance tab | Preserve the portal-specific workflow and access. |
| Dues, payment linking, owner charges, broker commissions and targets | Executive portal management | These functions already exist; improve their navigation before adding another ledger. |
| Overdue rent, due-soon payments, renewal alerts, maintenance approvals, unpaid commission | Executive dashboard attention panel and notification bell | Reuse for a “Today's work” entry available to executives. |
| Attendance, employee directory, payroll, leave, delegation | Employees page | Retain internal tabs and their role checks. |
| Access audit, portal audit, ownership audit | Three different existing views | A combined activity view would require explicit scope and deduplication. |
| Manual archive and aggregated system documents | Archive page | Keep the two existing sources distinguishable. |

Evidence: `app/ownership-properties/page.tsx:74`, `app/crm/page.tsx:88`, `app/property-management/page.tsx:42`, `app/employees/page.tsx:70`, `app/archive/page.tsx:79`, `components/portal/PortalDashboard.tsx:30`, `lib/portal/attention.ts`.

## Verified navigation issues

1. **Flat, partly implicit ordering.** `Sidebar.tsx:39` defines 16 items, but `:140` explicitly orders only nine. Remaining links inherit their definition order. Use one explicit grouped navigation definition to make placement predictable.
2. **Nested pages lose the selected sidebar link.** `Sidebar.tsx:197` compares exact paths. `/bills-forms/[slug]` therefore does not select the invoices/forms entry. Use exact matching plus a slash-delimited descendant check, avoiding broad prefix matching that selects unrelated routes.
3. **Header titles are incomplete.** `Header.tsx:86` omits bills/forms, portal management, users/access, and nested form pages. These fall back to a generic system title. A shared route metadata source can supply both short navigation labels and full titles.
4. **Quick search is only a field.** `Header.tsx:154` renders an input with no search handler, result UI, or form action. A permission-filtered navigation search is a useful small first step. Record search needs separate session-authorized API work. The current `/api/search` is an internal secret-token property endpoint; its secret must never be passed into the browser to connect this input.
5. **Mobile shortcuts underrepresent CRM.** `MobileBottomNav.tsx` takes the first four permitted items from dashboard, map, ownership, contracts, employees, archive. CRM is absent from that list. For executives and employees with those permissions, the visible four are dashboard, map, ownership, contracts. Consider dashboard, CRM, properties, contracts, plus More, or user-selected favorites; validate with actual staff workflows.
6. **Tabs mostly cannot be linked directly.** CRM, ownership, employees, and property-management tabs are component state. Appending `?tab=maintenance` alone will not select their maintenance view. PortalDashboard reads only `overview`, `payments`, `maintenance`, and `broker` from the query at mount, despite having additional executive tabs. Extend validated tab handling deliberately before adding shortcuts, including Back/Forward behavior.
7. **Permission mapping differs for daily reports.** Sidebar uses `daily-reports`, while AppShell maps all `/financials/*` to `financials`. With current roles both destinations remain executive-only, so this is a consistency issue rather than a demonstrated access bypass. Do not change permission semantics during cosmetic regrouping.

## Missing sections or views worth adding

| Priority | Suggested entry | Current coverage | Smallest useful change |
| --- | --- | --- | --- |
| First | أعمال اليوم | Executive attention view already exists | Add an executive-only shortcut to `/dashboard#attention`; no new task store. Staff-wide assigned work is a separate extension. |
| First | بحث الأقسام | No functioning header search | Search permitted navigation labels and Arabic synonyms locally, with keyboard support and a clear empty state. |
| Next | المفضلة | No favorites mechanism found | Optional account-scoped local route preferences; hide favorites when access changes. |
| Next | التقويم والمواعيد | CRM dated activities, maintenance visits, contract dates exist; no unified calendar page found | Start with a read-only calendar over authorized existing records; avoid changing appointment behavior. |
| Next | التحصيل والتجديدات | Dues, collection status, renewal alerts exist in portal/dashboard | Offer clearer executive shortcuts and filters before creating new workflows. |
| Later | سجل النشاط | Several separate audit views exist | Build a read-only combined view only after confirming coverage, identity, privacy, and retention rules. |
| Later | الإعدادات والتكاملات | Appearance/account controls and lease-end policy exist; no general integrations/settings screen found | Add a restricted settings hub. Hatif health needs real monitoring; static “connected” labels are insufficient. |

“Not found” means absent from the reviewed source/routes, not proof that an external system does not provide it. These are product recommendations, not all mandatory top-level sidebar entries.

## Boundaries that matter before expansion

- **Two maintenance models exist.** Property management uses `PropertyMaintenanceTask` with simple statuses; portal workflows use a richer `Maintenance` model with approvals, visits, attachments, and cost bearers. They are not interchangeable. A combined list needs verified identifiers, source labels, permissions, and deduplication. Navigation changes must not merge their storage.
- **Owner and financial views have different scopes.** Keep current calculations and record sources when adding shortcuts; do not sum separate views as if they were independent income streams.
- **Daily report content needs a separate accuracy pass.** `daily-reports/page.tsx:78` supplies canned operational narratives when no saved report exists, and `:160` sends `vacantUnitsCount: 3` to AI generation. Label fallback narratives and derive operational counts from actual authorized data before making this a prominent decision-support hub.
- **“إيجار نشط” in the header is static.** `Header.tsx:167` does not check connection health. Do not reuse it as evidence of a working integration in a settings hub.
- **Tax integration is unfinished in the source.** BillEditor explicitly identifies its QR/TLV work as preparation, not completed tax integration. A full accounting/tax module is outside a navigation update.

## Behavior-preserving implementation sequence

1. Introduce typed navigation metadata with stable group IDs, exact existing URLs and module keys, short labels, full titles, and optional descendant matching. Render groups only after filtering children with the existing `canAccess` function. Omit empty groups.
2. Update Sidebar and Header to consume that metadata. Preserve Next Link navigation, active-page ARIA, mobile close actions, dialog focus/Escape/backdrop behavior, theme tokens, and existing account controls. Keep page components, providers, data fetching, drafts, and route identities intact.
3. Adapt mobile group markup explicitly. Existing CSS assumes a flat tile grid and direct-child selectors; wrapping links without adjusting those rules can break the mobile layout.
4. Verify the grouped sidebar first. Add navigation search/favorites next. Implement URL-selected tabs separately, preserving unsaved forms and account/route-scoped draft keys.
5. Add calendar, integrations, or aggregated views as separately scoped changes with their own data/access verification. No schema migration is needed for initial regrouping.
6. Review the resulting local diff and authenticated visual checks before a separately authorized production deployment. Reverting navigation changes should require only reverting UI files, with no data rollback.

This approach minimizes regression risk; zero effect cannot be guaranteed without testing the actual change.

## Verification

Baseline checks against the unmodified app source using the local placeholder environment:

| Check | Result |
| --- | --- |
| `npm run build` | PASS: compilation, Next build type validation, static generation, and trace collection completed. |
| `npx tsc --noEmit` | PASS, exit 0. |
| `node tests/hatif.cjs` | PASS: mocked signature/scope/contact/event handling checks. |
| `node tests/drafts.cjs` | PASS: account/route/record isolation, signout, expiry, storage failure, and file-memory checks. |

The available runtime was Node `v24.19.0`; CLOUD_SETUP.md recommends Node 22. These results do not establish Node 22 parity. No production credentials were needed. Only this audit document was added.

Before releasing an implementation, verify:

- Exactly the same permitted destinations for ADMIN/CEO, HR, and EMPLOYEE; external OWNER/TENANT/BROKER accounts retain portal routing.
- Direct URLs and nested form routes, reloads, active groups, keyboard navigation, Arabic RTL, mobile drawer, account actions, and all three workspace appearance modes.
- Unsaved form drafts survive navigation and remain isolated by account; Hatif ingestion tests continue to pass.
- Mobile/tablet/desktop widths, long Arabic labels, scroll reachability, focus visibility, and the fixed desktop footer.
- Existing build/type checks and mocked Hatif/draft tests. These do not prove live database policy, production integrations, PDF rendering, or authenticated browser behavior.
