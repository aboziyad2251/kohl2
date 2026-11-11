# التأجير والمالية الداخلية — نسخة أولى للمراجعة

الحالة: تنفيذ محلي على فرع `codex/leasing-internal-finance`، مبني على
`codex/role-portals` عند `d1a4a9f` (يشمل إصلاح سجل جدولة KR).
لا نشر ولا تعديل لقاعدة بيانات الإنتاج في هذه المهمة.

## قرارات المستخدم

- التأجير يومي وشهري وسنوي، والموظف يتابع العملاء عبر هاتف ويدخل البيانات وينسق.
- مدير التشغيل مسؤول عن النظافة وجاهزية الوحدات.
- المالية داخل كحل، والمحاسب الخارجي يستلم التقارير دون حساب داخلي.
- جهة التحصيل تختلف بين كحل والمالك والمنصة.
- المستخدم والإدارة المخولة يعتمدون العمليات. التنفيذ يستخدم الأدوار الخاصة النشطة ADMIN/CEO؛ الموظف لا يعتمد حركة أو يؤكد سعراً/حجزاً.

## ما تعمل به هذه النسخة

- `/leasing`: يومي، طلبات التأجير، الوحدات والجاهزية، الأداء والتحسين.
- الطلب يرتبط بعميل CRM موجود، والموظف لا يختار إلا العملاء المسندين إلى سجل الموظف المرتبط بحسابه. الإدارة تستطيع إسناد الطلب عند إنشائه.
- متابعة محددة بتاريخ الرياض ونتيجة موثقة. عرض الوصول والمغادرة اليوم.
- وحدات ثابتة الهوية مرتبطة بالعقارات. الجاهزية للإدارة؛ التأكيد يحتاج وحدة جاهزة.
- فترات الحجز نصف مفتوحة: تاريخ البداية مشمول والمغادرة غير مشمولة، وينطبق ذلك على جميع المدد. يجب الاتفاق مع التشغيل على تحويل نهاية العقد الشاملة إلى مغادرة غير مشمولة عند الإدخال.
- منع تداخل تأكيدين على الوحدة نفسها بقفل قاعدة البيانات. إنشاء مستحق وجدول بدفعة واحدة عند التأكيد، مع تقسيمه إدارياً إلى دفعات مجموعها يساوي الإيجار قبل تسجيل أي تحصيل أو رد. ربط اختياري بعقد موجود، لا إنشاء عقد إيجار قانوني أو تحديثه آلياً.
- `/financials/internal`: مستحقات، تحصيل جزئي، مصروفات، تأمينات، رد تحصيل وصرف مبالغ للمالك. جهة التحصيل مستقلة عن صاحب استحقاق الإيجار.
- الموظف يقدم التحصيل/استلام التأمين لطلبه المؤكد؛ الإدارة وحدها تسجل بقية الأنواع وتعتمد/ترفض. يرى الموظف فقط الحركات التي قدمها، مع بيان أنها ليست إجمالي الشركة.
- لا تتجاوز التحصيلات المعتمدة المستحق؛ رد التأمين لا يتجاوز المستلم لدى نفس الجهة؛ صرف المالك ورد التحصيل يتحققان من الرصيد المتاح المسجل. لا تنفيذ لتحويلات بنكية.
- منع تكرار المراجع بحسب النوع والجهة للعمليات غير المرفوضة، ومفاتيح إعادة إرسال ثابتة للإنشاء. قرارات المراجعة نهائية؛ عند الخطأ استخدم مسار تسوية يراجعه المسؤول، لا تعديل السجل المعتمد.
- سجل خاص يحفظ قبل/بعد تغير الطلب والجاهزية والقرار. الإلغاء لطلب له حركات مالية يُحجب حتى إعداد تسوية منفصلة؛ لا حذف مالي آلي.
- تقارير Excel بحركات الفترة والمستحقات والتأجير والتدقيق، وملخص قابل للطباعة إلى PDF. تحفظ نسخة غير قابلة للتغيير ويمكن إعادة تنزيل آخر 50 نسخة من الشاشة. التاريخ المالي هو تاريخ العملية؛ الاعتماد المعروض كما كان عند حفظ النسخة.
- ملخص KR اختياري عبر `KOHL_OPERATIONS_KR_ENABLED=true` بعد تطبيق الترحيل. يضيف ملاحظات مستقلة ولا يجمع المالية الداخلية مع `financial_transactions` لتجنب احتساب العملية مرتين.
- لا حذف أو إعادة هيكلة للجداول القديمة، ولا تغيير لربط هاتف أو بيانات الحسابات.

## الدفعات والمستندات — 11 نوفمبر 2026

- جدول حتى 120 دفعة بتواريخ ومبالغ دقيقة. التحصيل والرد مرتبطان بالدفعة، ويمنع تجاوز رصيدها حتى مع طلبين متزامنين.
- PDF وPNG وJPEG وWebP حتى 5 ميغابايت للمستند و10 مستندات للحركة. التخزين خاص والتنزيل مصرح من الخادم؛ لا روابط عامة.
- رفع المستندات للحركات المنتظرة فقط، وتتجمد المرفقات عند اعتماد الحركة أو رفضها. الموظف يصل لمرفقات حركاته فقط.
- حزمة ZIP للمحاسب تضم Excel والمرفقات الموجودة عند حفظ التقرير وبيان تحقق SHA-256. الحد 200 ملف و50 ميغابايت؛ فقدان ملف أو تغيره يوقف التنزيل بالكامل.
- استعادة رفع انقطع بعد تخزين الملف دون استبداله، ومنع حذف مستند مكتمل عند فقدان استجابة الخادم. قد تحتاج الملفات اليتيمة الناتجة عن فشل تنظيف التخزين إلى صيانة منفصلة.

## تنبيهات انتهاء المدة

تعرض شاشة يومي الطلبات المؤكدة التي تنتهي خلال 3 أيام لليومي، و7 أيام للشهري،
و30 يوماً للسنوي، إضافة إلى المدد المنتهية، مرتبة بالأقرب وتوقيت الرياض.
هذه نوافذ تشغيل أولية ظاهرة للمستخدم وليست مواعيد إشعار قانوني أو أهداف أداء.
زر المتابعة يجهز الطلب والإجراء، ويظهر تنبيه عند وجود متابعة مفتوحة.
لا إرسال خارجي أو تمديد تلقائي أو تعديل لعقد. يستخدم العرض نطاق السجلات المصرح
للمستخدم؛ إنهاء الحالة القديمة يحتاج مراجعة الإدارة ومسار التسوية عند وجود حركات.

## المؤشرات وحدودها

- الالتزام: المتابعات المستحقة حتى وقت المشاهدة والتي أُنجزت قبل موعدها، من جميع المتابعات المستحقة في الفترة. العائق مسجل من الموظف ويظهر للإدارة لكنه لا يعفيه تلقائياً من المؤشر.
- التحويل: الطلبات المنشأة في الفترة والتي سُجل تأهيلها، ونسبة المؤكد منها حسب الحالة الحالية، لكل مدة منفصلة. الإدارة تستطيع اختيار موظف؛ الموظف يرى سجلاته فقط.
- لا هدف أو درجة عامة مثبتة بعد. سرعة الرد/معاودة المكالمات غير متاحة لأن مصدر هاتف الحالي لا يحتفظ بكل بيانات القياس. لا أرقام مصطنعة ولا خصم بسبب بيانات ناقصة.
- توصيات التحسين قواعد واضحة مبنية على المتأخرات والجاهزية والمراجعات المالية، وليست نموذج ذكاء يعتمد القرارات.
- حدود قراءة معلنة (5000 طلب/عميل، 10000 متابعة/حركة، 20000 حدث تدقيق). يتوقف العرض صراحة عند تجاوزها؛ لا اقتطاع صامت للأرقام. يلزم ترقيم صفحات وأرشفة قبل تجاوز هذه الأحجام.

## ما يبقى من الخطة الكبيرة

1. مراجعة التكامل مع Auth/PostgREST/Storage الحقيقي في بيئة معزولة قبل النشر؛ اختبارات التخزين الحالية تستخدم محاكاة API واختبارات صلاحيات SQL.
2. اعتماد التصنيفات والمعالجة الضريبية وقالب التصدير مع المحاسب، ومطابقة السجلات القديمة قبل ترحيل أرصدتها. هذه مساحة تشغيلية وليست دفتر أستاذ أو إقراراً ضريبياً.
3. مسارات تسوية/إلغاء محاسبي متقدمة، وصرف عمولات مرتبط بالحركات. واجهة العمولات الحالية تبقى المرجع؛ لم يُنشأ بديل لها.
4. إعداد ساعات الدوام وأهداف المؤشرات ومراجعة العوائق، وتحسين البحث والترقيم للحجم الكبير.
5. تكامل قنوات الحجز وقراءة الفواتير آلياً، وقياس سرعة الرد من بيانات هاتف الموثقة. لا ربط Airbnb مباشر في هذه النسخة.
6. توسيع ملخص PDF اليومي ليشمل التفاصيل والمرفقات؛ التقرير الكامل الآن في Excel والملخص ضمن KR عند تفعيله.

## Database and security

The first CLI-created candidate is `supabase/migrations/20261110143135_leasing_internal_finance.sql`.
Apply it before the second candidate, `20261110215449_operations_private_documents.sql`. Neither migration has been deployed; the first candidate was extended in this branch, not patched on production.
It introduces private tables with RLS and no direct anon/authenticated grants. The existing
project pattern of a narrow SECURITY DEFINER RPC is retained with an empty search path,
`auth.uid()` identity, active private account authorization, strict operation/key validation,
row/advisory locks, immutable decisions and persisted replay payload checks. No caller-supplied
role or actor is trusted. The separate KR RPC grants EXECUTE only to service_role and returns
aggregate counts/amounts without customer or payment-reference details.

Do not run all historical migrations, `supabase db push`, or old deployment scripts.
Before release, inspect real schemas/constraints, review a backup and rollback procedure,
validate the exact candidate image with isolated Auth/PostgREST and grant tests, and obtain
approval for this specific additive migration and main application cutover. This workspace
has no production connection or secrets. Broker/account images and routes must be preserved.

## Hatif release prerequisite

The user's VPS transcript reported a working local loader and local patch. These are not
proof of Git deployment readiness. This branch now stores `prepare_hatif_runtime` in
`scripts/release-broker-ui.py` and calls it in the historical payout helper before database
mutation or container stop. It reads `/home/debian/.config/kohl/hatif.env`, checks required
values, rejects invalid webhook secrets, and returns a copied runtime config. Original
inspect data remains intact for backup/rollback; only the main candidate is enriched.
No secrets are read by local tests, committed, or copied into the browser or broker image.

The historical payout release MUST NOT be rerun. The next main release's reviewed dispatcher
must use this preflight before any stop, validate the exact generated Env and preserve the
namespaced broker/account deployment. Verify helper provenance on the server; do not assume
its existing absolute-path scripts have been updated by a Git push. `runtime-container.private.json`
is a private inspect snapshot, not an env-file loader.

## Verification commands

```bash
npm ci
npm run build
npx tsc --noEmit
node scripts/check-release-baseline.cjs
node tests/operations.cjs
node tests/operations-db.cjs
node tests/operations-documents.cjs
node tests/operations-documents-api.cjs
node tests/operations-archive.cjs
python3 tests/hatif-runtime.py
# Requires isolated Docker PostgreSQL image, never production:
python3 scripts/test-operations-postgres.py
# Against locally running build, synthetic Auth/API fixtures only:
NODE_PATH=/path/to/playwright/node_modules node tests/operations-browser.cjs
```

PGlite tests cover role/ownership/direct-table denial, inactive accounts, duplicate/replay,
readiness/overlap, auto-dues, partial receipts, deposits, refunds/owner funds, decisions and
immutable report retrieval. Native PostgreSQL 17 tests establish two simultaneous blocked
sessions and verify competing bookings and competing partial-collection approvals.
Browser tests mock Auth/APIs: they verify UI flows, exports, responsive layouts and role controls,
not production identity or real bank reconciliation. Local TestSprite CLI is unavailable;
install/configure `testsprite` or run `testsprite setup` if that additional service is needed.

## Recorded local results — 10 November 2026

Passed production build, TypeScript, 78-route/six-category baseline; new schema/API/money/KPI/KR
checks; PGlite authorization/workflow tests; native PostgreSQL 17 booking/collection races;
Hatif runtime preservation tests; synthetic desktop/mobile create-request, collection approval,
Excel download, employee controls and external-redirect browser checks. Existing Hatif, drafts,
navigation, KR, audit, payout API and payout DB regressions also passed. Screenshots were visually
reviewed at 1440px and 390px. All data synthetic; no real bank transfer, customer write, deployed
Auth/PostgREST integration, production migration, production rollout or remote CI result is claimed.

## Recorded local results — 11 November 2026

The extended candidate passes build, TypeScript, the 78-route baseline, PGlite
installment/document authorization tests, real PostgreSQL concurrent installment
approval tests, document API failure/recovery tests, real XLSX/ZIP archive integrity
checks and synthetic desktop/mobile browser flows (schedule, upload, approval and
downloads). Production Storage/Auth integration remains unverified. The branch is
reviewed in https://github.com/aboziyad2251/kohl2/pull/2; no production changes.

## Offline restore rehearsal tooling — 11 November 2026

The server operator reported that candidate image
`sha256:67885302ad2cabf226ce35aeaee3830283f55446f5319473ccce3a21ae515b46`
built from application commit `13a546d` passed anonymous API rejection checks,
and that isolated PostgreSQL concurrency tests passed. A private database backup
was created and its archive listing checked; restore acceptance is still pending.

`tests/operations-restore.py IMAGE_ID` creates synthetic data with the installed
Supabase extensions, dumps/restores it in network-disabled temporary containers,
applies both candidate migrations, and checks database privileges. It requires the
already available Supabase PostgreSQL image. No production database is accessed.
Run this before the real-backup rehearsal. Local command-boundary tests passed;
full Supabase image acceptance could not run in the agent environment because
Docker ran out of disk while pulling the image. Do not report it as passed.

After synthetic acceptance, `scripts/rehearse-operations-restore.py --backup PATH`
reads role attributes/memberships (not passwords) from production in a read-only
transaction, restores the backup in an isolated temporary cluster using the exact
reviewed database image, and applies only the two hash-verified candidate migrations.
It bypasses the image's startup scripts, copies no production runtime configuration
or volumes, publishes no ports, and removes its temporary container/volume.
Diagnostic logs and receipts stay private beside the backup; never paste the logs.
Role login is disabled in the rehearsal; database privilege checks are not a full
Auth, PostgREST or Storage HTTP integration test. Encrypted Vault value recovery and
Storage object-file recovery are also outside this database archive test.

## Synthetic service HTTP acceptance

The operator reported successful real-backup restore, both candidate migrations
and SQL privilege checks in the disposable database; production remained unchanged.
The next tool, `python3 -B scripts/test-operations-services.py`, uses the exact
server image IDs for Auth, PostgREST, Storage and PostgreSQL. It creates a new
internal Docker network, synthetic database/users, generated test credentials and
a unique disposable Docker volume for file storage (xattrs required). No production containers, mounts, configuration, backups or
secrets are accessed. It requires 2 GiB available RAM, publishes no host ports,
and removes its own containers/anonymous volumes/network on exit. Diagnostics
stay private in a new temporary directory; do not share raw logs.

The script tests real password login and token validation, JWT-scoped finance RPC,
service-authorized document reservation/upload/finalization/download and denial
of direct authenticated/public file access. The exact application image is used
only as the Node HTTP test runner; this is not acceptance of the application's
own document routes or browser login flow. Syntax and mocked orchestration
isolation tests passed locally. Actual service startup/HTTP acceptance remains
pending the server run and must not be described as passed.


The initial service run reached authenticated finance RPC successfully but the
file upload failed because the host tmpfs lacked extended attributes. File storage
now uses a uniquely named, labelled test volume, explicitly removed after its
containers on success and failure. No existing/production bind mount is used.
Mock orchestration tests check volume scope and cleanup ordering; the actual
upload/download on the server remains pending the rerun.

The operator subsequently reported successful real Auth login, JWT-scoped finance
RPC and private file upload/download/direct-access denial, followed by complete
test container/volume/network cleanup.

`scripts/test-operations-services.py --application` now additionally runs the
previously built exact app image's server behind a loopback-only test router to
the isolated Auth/REST/Storage services. It exercises application entry creation,
multipart upload, integrity-checked download, approval/document freeze, saved
accountant ZIP, other-employee denial and deactivated-account denial.
The real portal_me function is loaded from its historical migration, with minimal
synthetic dependency tables and its reader role. This is HTTP API acceptance, not
a real browser sign-in test or full replica of the production gateway.
Driver assertions and existing isolation tests pass locally; the server run of
this additional mode remains pending. No production cutover is authorized by
running the rehearsal.
