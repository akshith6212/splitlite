## Architecture for Your Expense Splitting App

This is a great project. Let me address your decisions, counter where needed, and lay out a full architecture.

---

### Countering Your Technology Choices First

**React Native → Use Expo (React Native underneath)**
Plain React Native requires native build toolchains (Xcode, Android Studio) and separate CI/CD pipelines per platform. Expo gives you React Native under the hood but with a single codebase, OTA (over-the-air) updates without App Store resubmission, and `expo-router` which mirrors Next.js conventions. For an open-source app with contributors, this dramatically lowers the barrier to entry. When you eventually need native modules Expo doesn't support, you can "eject" to bare React Native.

**React → Use Next.js**
Plain React has no server-side rendering, no file-based routing, and requires you to separately configure bundling. Next.js gives you SSR/SSG for fast load times, API routes you can use during development, and it deploys trivially to AWS (via Amplify or a containerized setup). Since you're sharing code between web and mobile, you can also extract shared business logic and TypeScript types into a monorepo package both apps consume.

**Cognito → Keep it, but understand its limits**
Cognito is the right call for serverless auth — it's free up to 50,000 MAUs, handles JWT issuance, OAuth2 flows, and integrates natively with API Gateway authorizers. The downside is its hosted UI is dated and customization is limited. Use Cognito as the *auth engine* but build your own login/signup screens in both apps that call Cognito's SDK directly, never relying on the hosted UI.

---

### Monorepo Structure

Before touching AWS, structure your codebase as a monorepo using **Turborepo**:

```
/apps
  /web          → Next.js
  /mobile       → Expo
/packages
  /shared       → TypeScript types, API client, business logic
  /ui           → Shared UI components (for web/mobile where possible)
```

This means your `Transaction`, `Group`, `Split` types are defined once. Your API client (calls to your Lambda endpoints) is written once and used in both apps. This is critical for open-source maintainability.

---

### Full Backend Architecture (AWS Serverless)

```
Client Apps
    │
    ▼
Amazon CloudFront  ←── (CDN for web app static assets from S3)
    │
    ▼
Amazon API Gateway (HTTP API, not REST API — cheaper, faster)
    │
    ├── Cognito JWT Authorizer (validates every request)
    │
    ├── /groups        → Lambda: GroupsHandler
    ├── /transactions  → Lambda: TransactionsHandler
    ├── /settlements   → Lambda: SettlementsHandler
    ├── /users         → Lambda: UsersHandler
    └── /notifications → Lambda: NotificationsHandler
         │
         ▼
    Amazon DynamoDB (single-table design)
         │
         ▼
    DynamoDB Streams → Lambda: SettlementCalculator
                            │
                            ▼
                       Amazon SQS → Lambda: NotificationDispatcher
                                         │
                                         ▼
                                    Amazon SNS / SES
                                    (push + email alerts)
```

**Why HTTP API Gateway over REST API?** REST API costs $3.50/million requests, HTTP API costs $1.00/million. For a scaling open-source app, this matters. HTTP API also has lower latency.

**DynamoDB over Aurora Serverless?** Aurora Serverless v2 has a minimum cost of ~$43/month even at idle (minimum ACU charges). DynamoDB with on-demand pricing costs literally $0 until you have traffic, then $1.25 per million writes / $0.25 per million reads. For an early-stage app with unpredictable traffic, DynamoDB wins decisively. The tradeoff is you must think carefully about your access patterns upfront (single-table design).

**Why not use RDS or a relational DB?** Splits and settlements are graph-like relationships (who owes whom, in which group). DynamoDB handles this well with the right key design, and you avoid the cold-start penalty of Aurora Serverless.

---

### DynamoDB Single-Table Design

All entities live in one table. Access patterns drive the key structure:

| Entity | PK | SK | Attributes |
|---|---|---|---|
| User | `USER#userId` | `PROFILE` | name, email, avatar |
| Group | `GROUP#groupId` | `METADATA` | name, createdBy, currency |
| Group Member | `GROUP#groupId` | `MEMBER#userId` | role, joinedAt |
| User's Groups | `USER#userId` | `GROUP#groupId` | (for reverse lookup) |
| Transaction | `GROUP#groupId` | `TXN#timestamp#txnId` | amount, paidBy, description |
| Split | `TXN#txnId` | `SPLIT#userId` | amount, settled |
| Settlement | `GROUP#groupId` | `SETTLE#timestamp` | fromUser, toUser, amount |

This lets you do: "get all transactions in a group" (query PK=GROUP#x, SK begins_with TXN#), "get all groups for a user" (query PK=USER#x, SK begins_with GROUP#), and "get all splits for a transaction" in single queries with no joins.

---

### Settlement Calculation (The Core Logic)

This is the most important part. When transactions change, you need to recalculate who owes whom. Use the **DynamoDB Streams → Lambda** pattern:

1. Any write to a Transaction or Split item triggers the stream.
2. `SettlementCalculator` Lambda reads all unsettled splits for the group, runs the **debt simplification algorithm** (minimizes number of transactions needed to settle), and writes the result back as Settlement records.
3. This is async and doesn't block the user's API call.

The debt simplification algorithm: treat each member's net balance (total paid minus total owed) and use a greedy matching of the largest debtor to the largest creditor. This is O(n log n) and works well for groups up to hundreds of members.

---

### Frontend Architecture

**Web App (Next.js on AWS Amplify)**

```
Next.js App
├── /app
│   ├── (auth)/login, /signup     → Cognito SDK calls
│   ├── /dashboard                → Overview of all groups + balances
│   ├── /groups/[id]              → Group detail, transaction list
│   ├── /groups/[id]/add          → Add transaction + split calculator
│   └── /settle                   → Settlement flow
├── /packages/shared (monorepo)
│   ├── apiClient.ts              → Axios/fetch wrapper with Cognito token injection
│   ├── types.ts                  → Shared TS types
│   └── splitCalculator.ts        → Client-side split preview logic
```

Deploy Next.js to **AWS Amplify Hosting** — it handles SSR, has a free tier (1000 build minutes/month, 15 GB served/month), and auto-deploys from GitHub. This is significantly simpler than managing an EC2 or ECS setup for Next.js.

**Mobile App (Expo)**

Same API client from the shared package. Expo Router gives you a file-based navigation structure identical to Next.js. Key mobile-specific additions:

- **Expo Notifications** → connects to your SNS push endpoint for balance alerts
- **expo-secure-store** → stores Cognito tokens securely (never AsyncStorage for tokens)
- **React Query** → for data fetching, caching, and background refetch on app foreground

Both apps share `apiClient.ts`, so adding a new endpoint means updating one file.

---

### Auth Flow (Cognito)

```
User signs up/in
      │
      ▼
Cognito User Pool
      │ issues JWT (ID token + Access token + Refresh token)
      ▼
App stores tokens securely
      │
      ▼
Every API call → Authorization: Bearer <accessToken>
      │
      ▼
API Gateway Cognito Authorizer validates token (no Lambda needed, built-in)
      │
      ▼
Lambda receives event.requestContext.authorizer.claims (userId, email, etc.)
```

Use **Cognito User Pools** for email/password and social logins (Google OAuth). You do NOT need a custom authorizer Lambda — API Gateway has a native Cognito authorizer that validates JWTs in microseconds for free.

---

### Cost-Effective Deployment Steps

**Phase 1: Zero cost (0–1,000 users)**

1. **AWS Free Tier**: Lambda (1M requests/month free), DynamoDB (25 GB free), API Gateway (1M calls/month free), Cognito (50K MAUs free), CloudFront (1 TB free).
2. Deploy with **AWS SAM** (Serverless Application Model) or **SST (Ion)** — SST is more modern, has great DX, and generates CloudFormation under the hood. Define your entire backend as infrastructure-as-code.
3. Web: Amplify Hosting free tier covers you easily.
4. Mobile: Distribute via **Expo Go** app during development. Use **EAS Build** (Expo's cloud build service, free tier available) for TestFlight/Play Store beta builds.
5. Estimated monthly cost at this stage: **$0–$2**.

**Phase 2: Growth (1,000–50,000 users)**

1. DynamoDB on-demand pricing kicks in — still very cheap (~$1–5/month at moderate usage).
2. Lambda costs remain near-zero (1M free requests/month is generous).
3. Consider adding **ElastiCache (Redis)** only if you see DynamoDB hot-key issues — but with good key design, you won't need this until much later.
4. Add **AWS WAF** ($5/month) on CloudFront to protect against abuse as you open-source and publicize.
5. Estimated monthly cost: **$5–$25**.

**Phase 3: Scale (50,000+ users)**

1. Cognito remains free up to 50K MAUs — beyond that it's $0.0055/MAU, so 100K users = $275/month. At this point evaluate **self-hosted alternatives like Keycloak on Fargate** or stick with Cognito depending on revenue.
2. DynamoDB provisioned capacity with auto-scaling becomes cheaper than on-demand at high sustained traffic.
3. Add **API Gateway caching** for read-heavy endpoints like group settlement summaries.

---

### What You Should Build First (Phased)

**Week 1–2:** Monorepo setup, Cognito auth in both apps, basic Lambda + DynamoDB scaffold via SST, user profile creation.

**Week 3–4:** Groups CRUD, add transaction with equal split, basic balance display.

**Week 5–6:** Split calculator (unequal splits, percentage, by item), settlement calculation Lambda.

**Week 7–8:** Notifications (SES email + Expo push), settlement flow (mark as paid).

**Week 9+:** Open-source prep — README, contribution guide, GitHub Actions CI/CD pipeline that runs SAM/SST deploy on merge to main.

---

### Summary of Key Decisions

| Concern | Choice | Why |
|---|---|---|
| Mobile | Expo (React Native) | Lower barrier, OTA updates, shared code |
| Web | Next.js | SSR, simpler than plain React, Amplify deploys easily |
| Auth | Cognito | Free to 50K MAUs, native API Gateway integration |
| API | HTTP API Gateway | 3x cheaper than REST API |
| Database | DynamoDB on-demand | $0 at idle, scales infinitely, no minimum cost |
| Async work | DynamoDB Streams → Lambda | Settlement recalculation without blocking users |
| IaC | SST (Ion) | Best DX for serverless, deploys via CloudFormation |
| Web hosting | AWS Amplify | Free tier, SSR support, GitHub auto-deploy |
| Mobile distribution | EAS Build | Expo's cloud build, free tier for open source |

The biggest architectural win here is the **DynamoDB Streams → async Lambda** pattern for settlement calculation. It keeps your API fast (writes return instantly) while the complex math happens in the background, and scales to any number of concurrent group updates without coordination.