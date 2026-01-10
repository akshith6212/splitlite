1. **High-level architecture**
2. **Service-by-service breakdown**
3. **Scaling strategy (0 → millions of users)**
4. **Cost-optimization tips (VERY important for you)**
5. **Phase-wise evolution (don’t overbuild)**

---

## 🧱 High-Level AWS Architecture (Overview)

![Image](https://miro.medium.com/1%2AA1DtLRO3abrta6WprwcaKQ.png)

![Image](https://dz2cdn1.dzone.com/storage/temp/12896266-1578183626472.png)

![Image](https://docs.aws.amazon.com/images/whitepapers/latest/serverless-multi-tier-architectures-api-gateway-lambda/images/arch-pattern-serverless-mobile-backend.png)

![Image](https://docs.aws.amazon.com/images/wellarchitected/latest/serverless-applications-lens/images/reference-architecture-for-mobile-backend.png)

### Core idea:

* **Serverless-first**
* **Stateless APIs**
* **Single source of truth for data**
* **Feature gating via middleware**
* **Pay only when users actually use the app**

---

# 🏗️ Core Architecture Components

## 📱 Frontend

**Mobile App (Android / iOS)**

* Calls backend via HTTPS
* Auth handled by Cognito
* Uses feature flags from backend

(Optional later: Web app via CloudFront)

---

## 🌐 API Layer (Highly Scalable)

### **Amazon API Gateway**

* Entry point for all requests
* Rate limiting
* Throttling
* API versioning

Why this works:

* Scales automatically
* Protects backend from abuse
* Pay-per-request (cheap early)

---

## 🧠 Compute Layer (Business Logic)

### **AWS Lambda (Node.js / Java / Python)**

* One Lambda per domain:

    * `auth-service`
    * `group-service`
    * `expense-service`
    * `settlement-service`
    * `pricing-service`
    * `notification-service`

Best practices:

* Stateless functions
* Shared DB connection pooling
* Feature-check middleware inside Lambda

Scaling:

* Automatic horizontal scaling
* Zero idle cost

---

## 🔐 Authentication & Users

### **Amazon Cognito**

* Email / phone login
* OTP-based auth (India-friendly)
* JWT tokens
* Social login later (Google, Apple)

Why:

* Removes auth complexity
* Secure by default
* Scales infinitely

---

## 🗄️ Database Layer (Critical Choice)

### **Amazon Aurora PostgreSQL (Serverless v2)**

**Primary DB (Transactional)**

Stores:

* Users
* Groups
* Expenses
* Splits
* Purchases
* Features

Why Aurora:

* ACID guarantees (money!)
* Auto-scaling
* Read replicas
* Global DB later

💡 **Tip:**
Start with **1 writer + 1 reader**, add more readers as traffic grows.

---

### 🚀 Caching Layer

### **Amazon ElastiCache (Redis)**

Used for:

* Feature flags (`user_features`)
* Group balances
* Session-level calculations

This is a **huge performance win**.

---

## 📂 File Storage

### **Amazon S3**

Stores:

* Receipt images
* Exported CSV / PDF files
* Logs (optional)

Access via:

* Pre-signed URLs
* Time-limited access

---

## 🔔 Async & Background Jobs

### **Amazon SQS**

Used for:

* Sending reminders
* Expiry of packs
* Email notifications
* Settlement notifications

Why:

* Decouples heavy tasks
* Prevents Lambda timeouts

---

### ⏱️ Scheduled Jobs

### **Amazon EventBridge**

Used for:

* Expiring subscriptions
* Clearing expired features
* Daily reminders
* Analytics batch jobs

---

## 📧 Notifications

### **Amazon SNS**

* Push notifications
* Email triggers
* SMS (if needed)

---

## 📊 Analytics & Monitoring

### **Amazon CloudWatch**

* Logs
* Metrics
* Alerts

### **AWS X-Ray**

* Request tracing
* Performance bottlenecks

---

# 🔐 Security & Networking

### **VPC**

* Private subnets for DB
* Public only for API Gateway

### **IAM**

* Least-privilege access
* Separate roles per Lambda

### **AWS WAF**

* Protect APIs from bots & abuse

---

# 📈 Scaling Strategy (Very Important)

## Phase 1: MVP (0 → 50k users)

* API Gateway
* Lambda
* Aurora Serverless v2 (min capacity)
* No Redis initially
* Minimal SQS usage

💰 **Cost:** Very low

---

## Phase 2: Growth (50k → 500k users)

* Add Redis
* Add Aurora read replicas
* Add SQS-based async processing
* Enable CloudFront for static assets

---

## Phase 3: Scale (1M+ users)

* Split DB reads/writes
* Global Aurora (multi-region)
* Region-based API Gateways
* Feature-flag caching aggressively
* Move heavy analytics to Redshift

---

# 💸 Cost Optimization (This Is How You Beat Splitwise)

### ✅ Serverless-first

No idle EC2 costs

### ✅ Pay-per-use

Lambda + API Gateway = perfect for spiky traffic

### ✅ Cache feature checks

Avoid DB calls for paid features

### ✅ One DB, many services

Avoid early microservice DB hell

---

# 🔁 Example Request Flow (Expense Creation)

1. App → API Gateway
2. API Gateway → Lambda
3. Lambda:

    * Auth via Cognito token
    * Check `user_features` in Redis
    * Write expense to Aurora
4. Async notification → SQS
5. Notification Lambda → SNS

Fast, cheap, scalable.

---

# 🧠 Why This Architecture Is Ideal

✅ Scales automatically
✅ Very low starting cost
✅ Easy to add/remove paid features
✅ Clean separation of concerns
✅ India-friendly pricing viability


