# NCAMart Production Deployment Roadmap (ExonHost cPanel Guide)

This document provides the complete step-by-step roadmap for deploying **NCAMart (`ncamart.com`)** directly on your **ExonHost cPanel** account (`ncamartc`) using your built-in **cPanel PostgreSQL Database** and **cPanel Local Disk Storage (48.8 GB)** — **no Cloudflare R2 required**.

---

## 1. Architecture on Your ExonHost cPanel (`ncamartc`)

Based on your ExonHost cPanel panel:
- **cPanel Username**: `ncamartc`
- **Primary Domain**: `ncamart.com` (SSL Certificate Active)
- **Home Directory**: `/home/ncamartc`
- **RAM**: `4 GB` Physical Memory
- **Disk Space**: `48.83 GB` SSD (used for storing product pictures, QC videos, and PDFs directly in `/home/ncamartc/ncamart/public/uploads`)
- **Database**: Built-in **cPanel PostgreSQL Databases** (`127.0.0.1:5432`)
- **SSH Access**: Enabled in your cPanel Security section

```mermaid
flowchart TD
    USER["Bangladesh Users (ncamart.com)"] --> CPANEL["ExonHost cPanel (AutoSSL + LiteSpeed/Passenger)"]
    
    subgraph ExonHost cPanel Server (/home/ncamartc)
        CPANEL --> NODE["Setup Node.js App (server.js)"]
        NODE --> PG[("cPanel PostgreSQL Database (localhost:5432)")]
        NODE --> DISK[("cPanel 48.8GB Local Disk (/public/uploads)")]
    end

    subgraph External Gateways
        SSL["SSLCommerz Live Gateway"]
        COURIER["Couriers (Steadfast / Pathao / RedX)"]
        SMS["SMS & WhatsApp Gateway"]
    end

    NODE --> SSL
    NODE --> COURIER
    NODE --> SMS
```

> [!NOTE]
> **How Pictures & Videos Work Without Cloudflare R2**:
> - **PostgreSQL Database** stores all product info, prices, orders, customer accounts, and the **file path/URL** of every image/video.
> - **cPanel Local Disk (`/home/ncamartc/ncamart/public/uploads`)** stores the actual uploaded image and video files when `S3_ENDPOINT=local` is set in `.env`. You do **NOT** need Cloudflare R2!

---

## 2. Step-by-Step Deployment on Your ExonHost cPanel

### Step 1: Create Your PostgreSQL Database in ExonHost cPanel

1. In your ExonHost cPanel, scroll to **Databases** and click **PostgreSQL Database Wizard** (or **PostgreSQL Databases**).
2. **Create Database**:
   - Enter database name: `prod` → cPanel will create **`ncamartc_prod`**.
3. **Create Database User**:
   - Enter username: `admin` → cPanel will create **`ncamartc_admin`**.
   - Set a strong password (e.g., `NawabpurDb2026!`) and save it.
4. **Add User to Database**:
   - Select user `ncamartc_admin` and database `ncamartc_prod`, and click **Submit** (grant all privileges).
5. Your live `DATABASE_URL` inside cPanel will be:
   ```text
   postgresql://ncamartc_admin:YOUR_DB_PASSWORD@127.0.0.1:5432/ncamartc_prod
   ```

---

### Step 2: Build the Project on Your PC & Prepare `deploy.zip`

On your computer (inside `g:\My Drive\Nawabpur Complex Accessories\ncamart`):

1. **Run the production build**:
   ```powershell
   npm run build
   ```
2. **Create `deploy.zip`**:
   Select these folders/files and compress them into `deploy.zip` (do **NOT** include `node_modules` or `.git`):
   - `.next/`
   - `public/`
   - `src/`
   - `drizzle/` *(if present)*
   - `server.js`
   - `package.json` & `package-lock.json`
   - `next.config.ts` & `tsconfig.json`

---

### Step 3: Upload `deploy.zip` to ExonHost File Manager

1. In your ExonHost cPanel, click **File Manager** (under **Files**).
2. In the left sidebar, click your home folder **`/home/ncamartc`**.
3. Click **+ Folder** (top left) and create a folder named **`ncamart`**.
4. Open `/home/ncamartc/ncamart`, click **Upload**, and upload **`deploy.zip`**.
5. Once uploaded, right-click `deploy.zip` → **Extract** into `/home/ncamartc/ncamart`.
6. Delete `deploy.zip` after extracting.

---

### Step 4: Create the `.env` File in `/home/ncamartc/ncamart/.env`

Inside `/home/ncamartc/ncamart`, click **+ File** in cPanel File Manager, name it **`.env`**, right-click → **Edit**, and paste the following configuration:

```dotenv
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://ncamart.com
NEXT_PUBLIC_APP_URL=https://ncamart.com
NEXT_PUBLIC_API_BASE_URL=https://ncamart.com/api/v1

# Disable mock mode for live server
MOCK_EXTERNAL_SERVICES=false

# 1. ExonHost cPanel PostgreSQL Database
DATABASE_URL=postgresql://ncamartc_admin:YOUR_DB_PASSWORD@127.0.0.1:5432/ncamartc_prod

# 2. Local Disk Storage on ExonHost cPanel (No Cloudflare R2 Required!)
# Setting S3_ENDPOINT=local saves all pictures & videos to /home/ncamartc/ncamart/public/uploads
S3_ENDPOINT=local
S3_ACCESS_KEY_ID=local
S3_SECRET_ACCESS_KEY=local
S3_BUCKET_MEDIA=ncamart-media
S3_BUCKET_PRIVATE=ncamart-private
S3_BUCKET_AUDIT=ncamart-audit
S3_PUBLIC_DOMAIN=https://ncamart.com/uploads/ncamart-media

# 3. Redis (Optional on single-server cPanel; leave default or use Upstash free Redis)
REDIS_URL=redis://127.0.0.1:6379
ENABLE_REDIS_CACHE=false

# 4. Security Secrets (Replace with your own 64-character hex strings)
APP_ENCRYPTION_KEY=8f4b2e9a1c7d6f3e5a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f
SESSION_SECRET=1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=dGhpc2lzYTMyYnl0ZXJhbmRvbWtleWZvcm5leHRqcyE=

# 5. ExonHost cPanel Free Business Email (Create no-reply@ncamart.com in cPanel -> Email Accounts)
SMTP_HOST=mail.ncamart.com
SMTP_PORT=465
SMTP_USER=no-reply@ncamart.com
SMTP_PASSWORD=YOUR_EMAIL_PASSWORD
SMTP_FROM="NCAMart <no-reply@ncamart.com>"

# 6. Live Payment Gateway (SSLCommerz)
SSLCOMMERZ_STORE_ID=YOUR_LIVE_STORE_ID
SSLCOMMERZ_STORE_PASS=YOUR_LIVE_STORE_PASSWORD
SSLCOMMERZ_IS_SANDBOX=false

# 7. Courier & SMS Gateways (Update when ready)
SMS_PROVIDER=sslwireless
SMS_API_KEY=YOUR_SMS_API_KEY
SMS_SENDER_ID=NCAMart
STEADFAST_API_KEY=YOUR_STEADFAST_KEY
STEADFAST_SECRET_KEY=YOUR_STEADFAST_SECRET
```

---

### Step 5: Configure "Setup Node.js App" in ExonHost cPanel

1. In ExonHost cPanel, scroll down to **Software** and click **Setup Node.js App**.
2. Click **Create Application**:
   - **Node.js version**: Select **`22.x`** (or **`20.x`** — highest version available)
   - **Application mode**: **`Production`**
   - **Application root**: **`ncamart`**
   - **Application URL**: **`ncamart.com`** (leave the sub-path box empty)
   - **Application startup file**: **`server.js`**
3. Click **Create** (top right).
4. Once created, click **Run NPM Install** on that page (it will install all packages from `package.json`).

---

### Step 6: Run Database Migration & Create Your Super Admin (via cPanel SSH)

1. At the top of the **Setup Node.js App** page in cPanel, copy the `source /home/ncamartc/nodevenv/ncamart/...` command shown in the blue box.
2. Connect via **SSH Access** (or cPanel Terminal) and run:

```bash
# 1. Enter the Node.js virtual environment & project folder
source /home/ncamartc/nodevenv/ncamart/20/bin/activate && cd /home/ncamartc/ncamart

# 2. Create all PostgreSQL tables, enums, and indexes in ncamartc_prod
npm run db:migrate

# 3. Create your Super Admin login account for https://ncamart.com/admin
ADMIN_EMAIL="admin@ncamart.com" \
ADMIN_PHONE="+8801700000000" \
ADMIN_NAME="NCAMart Admin" \
ADMIN_PASSWORD="YourStrongAdminPassword2026!" \
npm run staff:create-admin
```

3. Finally, go back to **Setup Node.js App** in cPanel and click **Restart**!

---

## 3. Verifying Your Live Site (`https://ncamart.com`)

1. **Storefront**: Visit `https://ncamart.com` — your full storefront will load over HTTPS.
2. **Admin Panel Login**: Visit `https://ncamart.com/auth/login?mode=staff` and sign in with `admin@ncamart.com` and the password you set in Step 6.
3. **Upload Product Pictures & Videos**:
   - Any product image, QC photo, or RMA video uploaded through the site is now saved directly into `/home/ncamartc/ncamart/public/uploads/` on your ExonHost 48.8 GB SSD and linked automatically in your cPanel PostgreSQL database!
