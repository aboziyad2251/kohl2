# Real Estate Office Management System | نظام إدارة المكتب العقاري

A comprehensive bilingual (Arabic/RTL-first) Real Estate Office Management application built for property management, contract handling, customer orders, electronic powers of attorney (E-POA), brokerage agreements, and daily financial reporting.

---

## 🌟 Features & Modules

1. **Dashboard & KPIs (لوحة القيادة والمؤشرات)**:
   - Overview of key metrics, daily earnings, total transactions, active contracts, and quick navigation.
2. **Customer Orders (طلبات العملاء - عروض وطلبات)**:
   - Manage property listings, customer buy/rent requests, status tracking, and batch Excel imports.
3. **Property Management (إدارة العقارات والأملاك)**:
   - Track managed units, tenants, maintenance requests, and contract renewals.
4. **Financials & Daily Reports (المالية والتقارير اليومية)**:
   - Daily income/expense transactions, daily summaries, and automated PDF export reports.
5. **Earnings Breakdown (الأرباح والعمولات)**:
   - Track commissions, brokerage earnings, and revenue analytics.
6. **Contracts & Agreements (العقود والاتفاقيات)**:
   - Lease agreements, brokerage contracts, commission tracking, and wizard-based contract generators.
7. **Ownership & Legal Documents (إدارة الملكيات والوكالات)**:
   - Lessor details, ownership deeds, Electronic Powers of Attorney (E-POAs), and verification audits.
8. **General Services (الخدمات العامة والمصروفات)**:
   - Administrative and general office service requests and tracking.
9. **Standalone HTML/JS Website (`html_website/`)**:
   - Lightweight, standalone HTML5/CSS/JavaScript static version ready for zero-dependency deployment or local browser preview.

---

## 📁 Repository Structure

```
.
├── app/                  # Next.js App Router pages and API routes
├── components/           # Reusable React components & modal dialogs
├── context/              # Global application state (DataContext)
├── html_website/         # Standalone HTML5 / CSS / JS version
│   ├── css/              # Custom stylesheets (Glassmorphism design)
│   ├── js/               # Data store & UI components
│   └── *.html            # Individual standalone module pages
├── lib/                  # Services, database clients, types, validations
├── nginx/                # Reverse proxy & API Gateway configurations
├── supabase/             # PostgreSQL database initialization & migrations
├── Dockerfile            # Next.js production container build
├── docker-compose.yml    # Multi-service stack (DB, PostgREST, App, pgAdmin)
└── package.json          # Node dependencies and build scripts
```

---

## 🚀 Getting Started

### 1. Local Development (Next.js)

```bash
# Install dependencies
npm install

# Run the local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 2. Running the Standalone HTML Version

Navigate to the `html_website/` folder and open `index.html` in any modern web browser. No web server or node runtime is required.

---

### 3. Docker Compose Stack

Run the full local stack including PostgreSQL database, PostgREST, Next.js app, and pgAdmin:

```bash
docker-compose up -d
```

- **Next.js App**: [http://localhost:3005](http://localhost:3005)
- **PostgREST API**: [http://localhost:8020](http://localhost:8020)
- **pgAdmin**: [http://localhost:8099](http://localhost:8099)
- **PostgreSQL Database**: `localhost:5438`
