# 🏢 Real Estate ERP & Office Management Platform (Supabase Edition)

دليل ومواصفات ربط وتطوير منظومة إدارة المكتب العقاري (المكونة من 9 صفحات HTML رئيسية) بقاعدة بيانات Supabase المركزية مع دعم التزامن اللحظي، إدارة الصلاحيات، والتحليلات المالية والتشغيلية.

---

## 📋 Application Deployment Profile

```yaml
---
# APPLICATION PROFILE
app_name: "real-estate-office-mgmt"
subdomain: "office.mabotargagh.online"
container_tech: "docker-compose"
server_ip: "76.13.40.119"
ssh_user: "root"

# DATABASE CONFIGURATION
database_type: "Supabase Self-Hosted"
database_name: "postgres"
env_vars:
  - PORT: 8080
  - NODE_ENV: production
  - NEXT_PUBLIC_SUPABASE_URL: "https://office.mabotargagh.online"
  - NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoid2ViX2Fub24iLCJpc3MiOiJwb3N0Z3Jlc3QiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk4ODE1MDQwMH0.bagwe56G6djpeZq2a3gBWeM83HSIjkb2ZM633wNs-5Q"
---
```

---

## 📁 هيكلية المشروع الفنية (Repository Structure)

```
real-estate-office-mgmt/
│
├── 📁 html_website/                         # مجلد واجهات الويب والأصول التفاعلية
│   │
│   ├── 📄 index.html                       # 1. لوحة التحكم القيادية ومؤشرات الأداء (KPIs)
│   ├── 📄 customer-orders.html             # 2. طلبات العملاء (سكني / تجاري) والبحث
│   ├── 📄 property-management.html         # 3. إدارة الأملاك والتشغيل وأوامر الصيانة
│   ├── 📄 financials-earnings.html         # 4. الأرباح، الإيرادات، والمصروفات اليومية
│   ├── 📄 financials-daily-reports.html    # 5. التقرير اليومي ومستشار الذكاء الاصطناعي
│   ├── 📄 contracts.html                   # 6. مركز العقود، الإيجارات، ودورية الدفعات
│   ├── 📄 ownership-properties.html        # 7. صكوك الملكية، العقارات، والوكالات (E-POAs)
│   ├── 📄 brokerage-agreements.html        # 8. اتفاقيات الوساطة العقارية ونسب السعي
│   ├── 📄 general-services.html            # 9. الخدمات العامة (إيجار، بلدي، قوى، صكوك)
│   │
│   ├── 📁 js/                              # طبقة المنطق البرمجي والربط مع Supabase
│   │   ├── 📜 supabase-service.js          # المحرك الموحد لقاعدة البيانات والتزامن اللحظي
│   │   ├── 📜 export-utils.js              # معالج تصدير الجداول إلى Excel و CSV
│   │   ├── 📜 ui-interactions.js           # منطق النوافذ المنبثقة (Modals) والقوائم
│   │   ├── 📜 components.js                # القائمة الجانبية والشريط العلوي المشترك
│   │   └── 📜 data.js                      # البيانات الافتراضية والتخزين المحلي
│   │
│   ├── 📁 css/                             # ملفات التصميم والتنسيق
│   │   ├── 🎨 glassmorphism.css            # نمط التصميم الزجاجي الداكن الفاخر
│   │   ├── 🎨 rtl-layout.css               # ضبط الاتجاه والمحاذاة للغة العربية
│   │   └── 🎨 style.css                    # ملف الأنماط الرئيسي
│   │
│   └── 📁 assets/                          # الأيقونات والشعارات
│       └── 🖼️ logo.svg                     # شعار المكتب العقاري
│
├── 📁 supabase/                            # إعدادات قاعدة البيانات والمخططات
│   └── 📜 schema.sql                       # سكربت إنشاء الجداول، سياسات RLS، والتزامن
│
├── 📄 Dockerfile                           # ملف بناء حاوية Nginx لتشغيل التطبيق
├── 📄 docker-compose.yml                   # ملف إدارة ونشر الحاوية وربط الشبكة
├── 📄 nginx.conf                           # إعدادات خادم Nginx والتخزين المؤقت
├── 📄 netlify.toml                         # إعدادات النشر السحابي المباشر على Netlify
├── 📄 .env.example                         # نموذج المتغيرات البيئية ومفاتيح Supabase
└── 📄 README.md                            # دليل التشغيل والتوثيق الفني للمشروع
```

---

## 🚀 طرق التشغيل والنشر (Deployment Options)

### 1. النشر السحابي المباشر على Netlify (Zero-Config)
المشروع مهيأ ومربوط تلقائياً بملف [`netlify.toml`](file:///c:/Users/moham/OneDrive/%D8%B3%D8%B7%D8%AD%20%D8%A7%D9%84%D9%85%D9%83%D8%AA%D8%A8/kohl%20new/netlify.toml) لنشر مجلد `html_website` كواجهة ثابتة سريعة دون الحاجة لأي أوامر بناء:
1. اربط المستودع في Netlify (`https://github.com/aboziyad2251/kohl2`).
2. اضغط **Deploy Site** وسيعمل فوراً.

---

### 2. النشر عبر حاويات Docker (VPS / Cloud Server)

```bash
# بناء وتشغيل الحاوية في الخلفية
docker compose up -d --build
```
- المنظومة تعمل على المنفذ `8080` (أو المعين بـ Nginx Proxy Manager).

---

### 3. الاستعراض المحلي في المتصفح
يمكن فتح ملف [`html_website/index.html`](file:///c:/Users/moham/OneDrive/%D8%B3%D8%B7%D8%AD%20%D8%A7%D9%84%D9%85%D9%83%D8%AA%D8%A8/kohl%20new/html_website/index.html) مباشرة في أي متصفح ويب حديث بدون الحاجة لتثبيت أي خادم محلي.
