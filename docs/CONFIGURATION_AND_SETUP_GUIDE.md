# NCAMart Production Configuration & Setup Guide
**কনফিগারেশন ও সেটআপ সংক্রান্ত বিস্তারিত নির্দেশিকা (Step-by-Step Guide)**

এই ডকুমেন্টটিতে NCAMart প্ল্যাটফর্মের সমস্ত বাহ্যিক সার্ভিস (SMS Gateway, WhatsApp Business Cloud API, SMTP Email, Database, Redis ও Security Keys) সেটআপ এবং কনফিগার করার সহজ ও ধাপে ধাপে নির্দেশনা দেওয়া হলো।

---

## সূচিপত্র (Table of Contents)
1. [কোথায় ভ্যারিয়েবলগুলো যোগ করবেন (Where to Add Environment Variables)](#1-কোথায়-ভ্যারিয়েবলগুলো-যোগ-করবেন)
2. [পার্ট ১: SMS Gateway কনফিগারেশন (মোবাইল এসএমএস)](#part-1-sms-gateway-configuration)
3. [পার্ট ২: WhatsApp Business Cloud API কনফিগারেশন](#part-2-whatsapp-business-cloud-api-configuration)
4. [পার্ট ৩: Google OAuth 2.0 Sign-In কনফিগারেশন (অতি দ্রুত লগইন)](#part-3-google-oauth-20-sign-in-configuration)
5. [পার্ট ৪: SMTP ইমেইল সেটআপ (cPanel Webmail / Gmail / Zoho)](#part-4-smtp-email-setup)
6. [পার্ট ৫: ডাটাবেজ ও রেডিস সেটআপ (PostgreSQL & Redis)](#part-5-database--redis-configuration)
7. [পার্ট ৬: সিকিউরিটি ও এনক্রিপশন কি (Security Peppers & Keys)](#part-6-security--encryption-keys)
8. [সার্ভিস টেস্ট ও ভেরিফিকেশন চেকলিস্ট (Verification & Testing)](#verification--testing)
9. [সাধারণ সমস্যা ও সমাধান (Troubleshooting)](#troubleshooting)
5. [পার্ট ৪: ডাটাবেজ ও রেডিস সেটআপ (PostgreSQL & Redis)](#part-4-database--redis-configuration)
6. [পার্ট ৫: সিকিউরিটি ও এনক্রিপশন কি (Security Peppers & Keys)](#part-5-security--encryption-keys)
7. [সার্ভিস টেস্ট ও ভেরিফিকেশন চেকলিস্ট (Verification & Testing)](#verification--testing)
8. [সাধারণ সমস্যা ও সমাধান (Troubleshooting)](#troubleshooting)

---

## 1. কোথায় ভ্যারিয়েবলগুলো যোগ করবেন

### ক) লোকাল কম্পিউটারে ডেভেলপমেন্টের জন্য:
প্রজেক্টের রুট ফোল্ডারে `.env.local` ফাইলে ভ্যালুগুলো যোগ করুন:
```bash
# ফাইলের লোকেশন:
G:\My Drive\Nawabpur Complex Accessories\ncamart\.env.local
```

### খ) cPanel লাইভ প্রোডাকশন সার্ভারে:
1. cPanel-এ লগইন করুন।
2. **Software** সেকশন থেকে **"Setup Node.js App"**-এ যান।
3. আপনার অ্যাপ্লিকেশনটি সিলেক্ট করে **Edit (কলম আইকন)**-এ ক্লিক করুন।
4. স্ক্রল করে নিচে **"Environment Variables"** অপশনে যান।
5. **"Add Variable"** বাটনে ক্লিক করে প্রতিটি Name এবং Value ইনপুট দিয়ে **"Save"** করুন।
6. সবশেষে উপরে **"Restart"** বাটনে ক্লিক করে অ্যাপ রিস্টার্ট দিন।

---

## Part 1: SMS Gateway Configuration
*(ব্যবহারকারীর পাসওয়ার্ড রিসেট, অর্ডার কনফার্মেশন ও ওটিপি পাঠানোর জন্য)*

NCAMart সিস্টেমে বাংলাদেশি যেকোনো স্ট্যান্ডার্ড HTTP/REST SMS Gateway (যেমন: Greenweb, Onnorokom, Alpha SMS, BulkSMSBD ইত্যাদি) সাপোর্ট করে।

### ধাপসমূহ:
1. আপনার নির্বাচিত SMS প্রোভাইডারের পোর্টালে একাউন্ট তৈরি করে রিচার্জ করুন।
2. আপনার প্রোফাইল বা API সেটিংস থেকে **API Key / Token** কপি করুন।
3. BTRC অনুমোদিত আপনার **Sender ID / Masking Name** (যেমন: `NCAMart` বা নন-মাস্কিং কোড) সংগ্রহ করুন।
4. পরিবেশক ভ্যারিয়েবল ফাইলে নিচের তথ্যগুলো বসান:

```env
# ==========================================
# SMS GATEWAY SETTINGS
# ==========================================
SMS_PROVIDER="primary"                     # অপশন: primary / mock
SMS_API_KEY="your_sms_gateway_api_key_here"
SMS_API_URL="https://api.sms-provider.com/v1/send"
SMS_SENDER_ID="NCAMart"                    # অনুমোদিত প্রেরক নাম / আলফানিউমেরিক আইডি
```

---

## Part 2: WhatsApp Business Cloud API Configuration
*(ইউজারদের সরাসরি হোয়াটসঅ্যাপে ভেরিফিকেশন ওটিপি ও ওয়ান-ক্লিক লিঙ্ক দেওয়ার জন্য)*

NCAMart প্ল্যাটফর্মে মেটা (Meta) অফিসিয়াল **WhatsApp Cloud API** এবং সরাসরি **One-Click Action Link** (`wa.me`) উভয় ব্যবস্থা রয়েছে।

### ধাপসমূহ:
1. [Meta for Developers](https://developers.facebook.com/) পোর্টালে যান এবং লগইন করুন।
2. **"My Apps"** > **"Create App"** > টাইপ সিলেক্ট করুন **"Business"**।
3. অ্যাপের ড্যাশবোর্ডে **"Add Products to Your App"** থেকে **WhatsApp** সেটআপ বাটনে ক্লিক করুন।
4. **API Setup** পেজ থেকে নিচের তথ্যগুলো সংগ্রহ করুন:
   - **Phone Number ID** (এটি আপনার বিজনেস ফোন নাম্বারের মেটা আইডি)
   - **WhatsApp Business Account ID (WABA ID)**
   - **Permanent Access Token** (System Users সেকশন থেকে স্থায়ী টোকেন তৈরি করে নিন)
5. ভ্যারিয়েবল ফাইলে যুক্ত করুন:

```env
# ==========================================
# WHATSAPP CLOUD API SETTINGS
# ==========================================
WHATSAPP_API_TOKEN="EAAxxxxxxxxx_your_meta_system_user_token_here"
WHATSAPP_PHONE_NUMBER_ID="109283746501928"
WHATSAPP_BUSINESS_ACCOUNT_ID="192837465019283"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="nca_wa_verify_secret_2026"
```

> [!TIP]
> **WhatsApp Direct Action:** ইউজারদের মোবাইল স্ক্রিনে সরাসরি একটি সবুজ **"Open WhatsApp Directly"** বাটন থাকে। কোনো কারণে এপিআই টোকেন মেয়াদোত্তীর্ণ হলেও কাস্টমার বাটনে ক্লিক করে সাথে সাথে হোয়াটসঅ্যাপ ওপেন করে সাপোর্ট টিম থেকে কোড উদ্ধার করতে পারবেন।

---

## Part 3: Google OAuth 2.0 Sign-In Configuration
*(ইউজার ও স্টাফদের অতি দ্রুত গুগল দিয়ে সাইন-ইন এবং প্রোফাইল নির্বাচন স্ক্রিন খোলার জন্য)*

NCAMart প্ল্যাটফর্মে জিরো-ল্যাটেন্সি **Direct Client-Side Redirection** এবং **DNS Preconnect** ইঞ্জিন সংযুক্ত করা হয়েছে যাতে বাটন ক্লিকের সাথে সাথেই **০ মিলিসেকেন্ডে** সরাসরি গুগলের প্রোফাইল সিলেকশন উইন্ডো খুলে যায়।

### ধাপসমূহ:
1. [Google Cloud Console](https://console.cloud.google.com/) এ যান এবং আপনার প্রজেক্ট সিলেক্ট করুন।
2. **APIs & Services > Credentials** এ যান।
3. **"Create Credentials" > "OAuth client ID"** সিলেক্ট করুন:
   - Application type: **Web application**
   - Name: "NCAMart Web Auth"
   - Authorized JavaScript origins:
     - `https://ncamart.com`
     - `http://localhost:3000` (লোকাল ডেভেলপমেন্ট)
   - Authorized redirect URIs:
     - `https://ncamart.com/api/v1/auth/google/callback`
     - `http://localhost:3000/api/v1/auth/google/callback`
4. তৈরি হওয়া **Client ID** এবং **Client Secret** সংগ্রহ করে ফাইলে বসান:

```env
# ==========================================
# GOOGLE OAUTH 2.0 SETTINGS (INSTANT LOGIN)
# ==========================================
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your_google_client_secret"
```

> [!TIP]
> **কেন \`NEXT_PUBLIC_GOOGLE_CLIENT_ID\` গুরুত্বপূর্ণ:**
> ব্রাউজার যখন \`NEXT_PUBLIC_GOOGLE_CLIENT_ID\` সরাসরি পায়, তখন বাটন চাপার সাথে সাথে কোনো সার্ভার রাউন্ড-ট্রিপ ছাড়াই **০ মিলিসেকেন্ডে সরাসরি গুগলের প্রোফাইল উইন্ডো খুলে যায়**।

---

## Part 4: SMTP Email Setup
*(ইমেইলে পাসওয়ার্ড রিসেট কোড, সিকিউরিটি নোটিশ ও ইনভয়েস প্রেরণের জন্য)*

cPanel ওয়েবমেইল, জিমেইল অ্যাপ পাসওয়ার্ড (Google Workspace), অথবা প্রফেশনাল SMTP (যেমন: Amazon SES, SendGrid, Brevo) ব্যবহার করতে পারেন।

### cPanel Webmail ব্যবহার করলে:
1. cPanel > **Email Accounts** এ যান।
2. একটি ইমেইল তৈরি করুন (যেমন: `security@ncamart.com` বা `support@ncamart.com`)।
3. **Connect Devices**-এ ক্লিক করে আপনার **Outgoing SMTP Server**, **Port (465 বা 587)** দেখে নিন।
4. কনফিগারেশনে বসান:

```env
# ==========================================
# SMTP EMAIL SETTINGS
# ==========================================
SMTP_HOST="mail.ncamart.com"               # অথবা আপনার হোস্টিং সার্ভার আইপি
SMTP_PORT=465                              # SSL এর জন্য 465 অথবা TLS এর জন্য 587
SMTP_SECURE="true"                         # 465 হলে true, 587 হলে false
SMTP_USER="security@ncamart.com"
SMTP_PASSWORD="your_email_account_password"
SMTP_FROM_EMAIL="security@ncamart.com"
SMTP_FROM_NAME="NCAMart Security Team"
```

### Google Workspace / Gmail App Password ব্যবহার করলে:
1. আপনার Google Account-এ যান > **Security** > **2-Step Verification** চালু করুন।
2. নিচে **"App passwords"** অপশনে যান এবং নতুন একটি অ্যাপ পাসওয়ার্ড তৈরি করুন (১৬ অক্ষরের কোড)।
3. কনফিগারেশনে বসান:
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE="true"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="xxxx xxxx xxxx xxxx"        # জেনারেট করা ১৬ অক্ষরের অ্যাপ পাসওয়ার্ড
SMTP_FROM_EMAIL="your-email@gmail.com"
SMTP_FROM_NAME="NCAMart Team"
```

---

## Part 5: Database & Redis Configuration
*(ইউজার, স্টাফ পাসওয়ার্ড ও সিকিউর সেশন ব্যবস্থাপনার মূল ভিত্তি)*

```env
# ==========================================
# POSTGRESQL DATABASE
# ==========================================
DATABASE_URL="postgresql://username:password@localhost:5432/ncamart_prod?sslmode=prefer"

# ==========================================
# REDIS CACHE & SESSION STORE
# ==========================================
REDIS_URL="redis://127.0.0.1:6379"         # cPanel বা লোকাল রেডিস সংযোগ
```

> [!NOTE]
> কোনো কারণে সার্ভারে Redis সাময়িকভাবে অফলাইনে থাকলেও সিস্টেমে স্বয়ংক্রিয় **In-Memory Fallback Map** সংযুক্ত রয়েছে, ফলে ওটিপি বা পাসওয়ার্ড রিসেট কখনো আটকে থাকবে না।

---

## Part 6: Security & Encryption Keys
*(পাসওয়ার্ড হ্যাশিং, ওটিপি পেপারিং ও টোকেন এনক্রিপশন)*

নিরাপত্তার জন্য নিচের ভ্যারিয়েবলগুলো যেকোনো দীর্ঘ র্যান্ডম স্ট্রিং দিয়ে সুরক্ষিত রাখুন:

```env
# ==========================================
# SECURITY PEPPERS & ENCRYPTION
# ==========================================
OTP_PEPPER="nca_secure_reset_pepper_948f72a6c1e"
AUTH_SECRET="nca_jwt_production_secret_key_827163"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" # ৩২ বাইটের হেক্স স্ট্রিং
```

---

## Verification & Testing
*(সেটআপ শেষে সবকিছু ঠিকঠাক কাজ করছে কিনা যেভাবে পরীক্ষা করবেন)*

1. **পাসওয়ার্ড রিসেট পেজে যান:**
   - ব্রাউজারে খুলুন: `https://ncamart.com/account/reset-password` (অথবা `/auth/reset-password`)
2. **এসএমএস টেস্ট:**
   - আপনার ফোন নাম্বার লিখুন > **SMS Message** সিলেক্ট করুন > **Send Verification Code** চাপুন।
   - ফোনে ৬-সংখ্যার এসএমএস এসেছে কিনা দেখুন।
3. **হোয়াটসঅ্যাপ টেস্ট:**
   - **WhatsApp** সিলেক্ট করে কোড পাঠান। সরাসরি স্ক্রিনের **"Open WhatsApp Directly"** বাটনে ক্লিক করে চ্যাট উইন্ডো খুলছে কিনা দেখুন।
4. **ইমেইল টেস্ট:**
   - আপনার ইমেইল লিখুন > **Email** সিলেক্ট করুন > কোড পাঠান। ইনবক্স অথবা স্প্যাম ফোল্ডারে ব্র্যান্ডেড ভেরিফিকেশন ইমেইল এসেছে কিনা দেখুন।
5. **পাসওয়ার্ড আপডেট কনফার্মেশন:**
   - ওটিপি ও নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর) ইনপুট দিয়ে সাবমিট করুন।
   - সফলভাবে পাসওয়ার্ড পরিবর্তন হবে এবং সাথে সাথে সিস্টেমে থাকা সকল পুরনো ব্রাউজার সেশন সিকিউরিটির জন্য ডিসকানেক্ট হয়ে যাবে।
   - নতুন পাসওয়ার্ড দিয়ে `/auth/login`-এ লগইন করে পরীক্ষা সম্পন্ন করুন।

---

## Troubleshooting
*(সম্ভাব্য সমস্যা ও দ্রুত সমাধান)*

| সমস্যা | কারণ | সমাধান |
| :--- | :--- | :--- |
| **Email যাচ্ছে না (Connection Timeout)** | হোস্টিং সার্ভার বহির্গামী পোর্ট 465/587 ব্লক করেছে | cPanel সাপোর্ট টিমে একটি টিকিট খুলে "Outgoing SMTP port 465/587" আনব্লক করতে বলুন। |
| **SMS পৌঁছাচ্ছে না** | একাউন্টে পর্যাপ্ত ব্যালেন্স নেই বা API কি ভুল | এসএমএস গেটওয়ে ড্যাশবোর্ডে লগইন করে ব্যালেন্স ও এপিআই কি সঠিক আছে কিনা চেক করুন। |
| **WhatsApp কোড আসছে না** | মেটা টেমপ্লেট অনুমোদন বাকি অথবা টেস্ট নাম্বার সীমাবদ্ধ | মেটা বিজনেস ম্যানেজারে `otp_verification_bn` টেমপ্লেটটি সাবমিট করুন অথবা সরাসরি "Open WhatsApp" বাটন ব্যবহার করুন। |
| **রিসেট পেজে 404 দেখায়** | গিট পুল বা বিল্ড আপডেট বাকি | সার্ভারে `git pull origin main` দিয়ে সর্বশেষ কোড নামিয়ে নিন। |

---
*ডকুমেন্টটি সর্বদা হালনাগাদ রাখতে এবং দলগত সহায়তায় ব্যবহার করুন।*

