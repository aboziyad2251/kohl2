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
- منع تداخل تأكيدين على الوحدة نفسها بقفل قاعدة البيانات. إنشاء مستحق واحد عند التأكيد. ربط اختياري بعقد موجود، لا إنشاء عقد إيجار قانوني أو تحديثه آلياً.
- `/financials/internal`: مستحقات، تحصيل جزئي، مصروفات، تأمينات، رد تحصيل وصرف مبالغ للمالك. جهة التحصيل مستقلة عن صاحب استحقاق الإيجار.
- الموظف يقدم التحصيل/استلام التأمين لطلبه المؤكد؛ الإدارة وحدها تسجل بقية الأنواع وتعتمد/ترفض. يرى الموظف فقط الحركات التي قدمها، مع بيان أنها ليست إجمالي الشركة.
- لا تتجاوز التحصيلات المعتمدة المستحق؛ رد التأمين لا يتجاوز المستلم لدى نفس الجهة؛ صرف المالك ورد التحصيل يتحققان من الرصيد المتاح المسجل. لا تنفيذ لتحويلات بنكية.
- منع تكرار المراجع بحسب النوع والجهة للعمليات غير المرفوضة، ومفاتيح إعادة إرسال ثابتة للإنشاء. قرارات المراجعة نهائية؛ عند الخطأ استخدم مسار تسوية يراجعه المسؤول، لا تعديل السجل المعتمد.
- سجل خاص يحفظ قبل/بعد تغير الطلب والجاهزية والقرار. الإلغاء لطلب له حركات مالية يُحجب حتى إعداد تسوية منفصلة؛ لا حذف مالي آلي.
- تقارير Excel بحركات الفترة والمستحقات والتأجير والتدقيق، وملخص قابل للطباعة إلى PDF. تحفظ نسخة غير قابلة للتغيير ويمكن إعادة تنزيل آخر 50 نسخة من الشاشة. التاريخ المالي هو تاريخ العملية؛ الاعتماد المعروض كما كان عند حفظ النسخة.
- ملخص KR اختياري عبر `KOHL_OPERATIONS_KR_ENABLED=true` بعد تطبيق الترحيل. يضيف ملاحظات مستقلة ولا يجمع المالية الداخلية مع `financial_transactions` لتجنب احتساب العملية مرتين.
- لا حذف أو إعادة هيكلة للجداول القديمة، ولا تغيير لربط هاتف أو بيانات الحسابات.

## المؤشرات وحدودها

- الالتزام: المتابعات المستحقة حتى وقت المشاهدة والتي أُنجزت قبل موعدها، من جميع المتابعات المستحقة في الفترة. العائق مسجل من الموظف ويظهر للإدارة لكنه لا يعفيه تلقائياً من المؤشر.
- التحويل: الطلبات المنشأة في الفترة والتي سُجل تأهيلها، ونسبة المؤكد منها حسب الحالة الحالية، لكل مدة منفصلة. الإدارة تستطيع اختيار موظف؛ الموظف يرى سجلاته فقط.
- لا هدف أو درجة عامة مثبتة بعد. سرعة الرد/معاودة المكالمات غير متاحة لأن مصدر هاتف الحالي لا يحتفظ بكل بيانات القياس. لا أرقام مصطنعة ولا خصم بسبب بيانات ناقصة.
- توصيات التحسين قواعد واضحة مبنية على المتأخرات والجاهزية والمراجعات المالية، وليست نموذج ذكاء يعتمد القرارات.
- حدود قراءة معلنة (5000 طلب/عميل، 10000 متابعة/حركة، 20000 حدث تدقيق). يتوقف العرض صراحة عند تجاوزها؛ لا اقتطاع صامت للأرقام. يلزم ترقيم صفحات وأرشفة قبل تجاوز هذه الأحجام.

## ما يبقى من الخطة الكبيرة

1. رفع المستندات إلى التخزين الخاص وتجميع مرفقات المحاسب؛ النسخة الحالية تحفظ مرجع المستند ومكانه فقط. لا تضع روابط عامة لمستندات خاصة.
2. اعتماد التصنيفات والمعالجة الضريبية وقالب التصدير مع المحاسب، ومطابقة السجلات القديمة قبل ترحيل أرصدتها. هذه مساحة تشغيلية وليست دفتر أستاذ أو إقراراً ضريبياً.
3. جداول دفعات متعددة بدلاً من مستحق واحد، ومسارات تسوية/إلغاء محاسبي متقدمة، وصرف عمولات مرتبط بالحركات. واجهة العمولات الحالية تبقى المرجع؛ لم يُنشأ بديل لها.
4. إعداد ساعات الدوام وأهداف المؤشرات ومراجعة العوائق، وتنبيهات التجديد، وتحسين البحث والترقيم للحجم الكبير.
5. تكامل قنوات الحجز وقراءة الفواتير آلياً، وقياس سرعة الرد من بيانات هاتف الموثقة. لا ربط Airbnb مباشر في هذه النسخة.
6. توسيع ملخص PDF اليومي ليشمل التفاصيل والمرفقات؛ التقرير الكامل الآن في Excel والملخص ضمن KR عند تفعيله.

## Database and security

The CLI-created candidate is `supabase/migrations/20261110143135_leasing_internal_finance.sql`.
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
