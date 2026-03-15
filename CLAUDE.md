# SplitLite - AI Assistant Guide

## Project Overview

SplitLite is an open-source expense-splitting application (similar to Splitwise) built with a serverless architecture on AWS. The app allows users to create groups, add transactions, split expenses, and calculate settlements efficiently.

## Technology Stack

### Frontend
- **Mobile**: Expo (React Native) with Expo Router for file-based navigation
- **Web**: Next.js with App Router for SSR/SSG
- **Monorepo**: Turborepo for managing multiple apps and shared packages
- **State Management**: React Query for data fetching and caching
- **Auth**: AWS Cognito SDK (custom UI, not hosted UI)

### Backend (AWS Serverless)
- **API**: HTTP API Gateway (not REST API - cheaper and faster)
- **Auth**: Cognito User Pools with native API Gateway JWT authorizer
- **Compute**: AWS Lambda functions
- **Database**: DynamoDB with single-table design
- **Async Processing**: DynamoDB Streams → Lambda for settlement calculations
- **Notifications**: SQS → Lambda → SNS/SES for push and email alerts
- **Infrastructure**: SST (Ion) for infrastructure-as-code
- **Web Hosting**: AWS Amplify Hosting
- **Mobile Distribution**: EAS Build

## Code Organization

```
/apps
  /web          → Next.js web application
  /mobile       → Expo mobile application
/packages
  /shared       → TypeScript types, API client, business logic
  /ui           → Shared UI components (cross-platform where possible)
```

## Key Architectural Patterns

### 1. Monorepo Structure
- All shared code lives in `/packages/shared`
- TypeScript types (`Transaction`, `Group`, `Split`, etc.) are defined once
- API client is written once and used by both web and mobile apps
- Changes to shared code affect both applications - test thoroughly

### 2. DynamoDB Single-Table Design

All entities exist in one table with carefully designed access patterns:

| Entity | PK | SK | Purpose |
|--------|----|----|---------|
| User | `USER#userId` | `PROFILE` | User metadata |
| Group | `GROUP#groupId` | `METADATA` | Group information |
| Group Member | `GROUP#groupId` | `MEMBER#userId` | Group membership |
| User's Groups | `USER#userId` | `GROUP#groupId` | Reverse lookup |
| Transaction | `GROUP#groupId` | `TXN#timestamp#txnId` | Transaction records |
| Split | `TXN#txnId` | `SPLIT#userId` | Individual splits |
| Settlement | `GROUP#groupId` | `SETTLE#timestamp` | Settlement records |

**Important**: Never add queries that don't follow these access patterns. DynamoDB is optimized for these specific query patterns.

### 3. Async Settlement Calculation

**Critical Pattern**: Settlement calculations are asynchronous and event-driven.

- When transactions or splits are modified, DynamoDB Streams trigger the `SettlementCalculator` Lambda
- This Lambda runs the debt simplification algorithm (greedy matching of largest debtor to largest creditor)
- Results are written back as Settlement records
- This keeps API responses fast while handling complex calculations in the background
- **Never** block API responses waiting for settlement calculations

### 4. Authentication Flow

- Users authenticate via Cognito User Pools (email/password + OAuth)
- Apps receive JWT tokens (ID, Access, Refresh)
- Every API call includes `Authorization: Bearer <accessToken>` header
- API Gateway validates tokens automatically (no Lambda authorizer needed)
- Lambda functions receive user info in `event.requestContext.authorizer.claims`
- **Never** store tokens in AsyncStorage on mobile - use `expo-secure-store`

## Development Guidelines

### Code Sharing
- **DO**: Extract business logic, types, and API clients to `/packages/shared`
- **DO**: Keep platform-specific code (navigation, UI components) in respective apps
- **DON'T**: Duplicate code between web and mobile - refactor to shared packages

### Database Operations
- **DO**: Follow the established PK/SK patterns for all queries
- **DO**: Use batch operations for multiple items when possible
- **DON'T**: Add secondary indexes without careful consideration of cost
- **DON'T**: Use scans - always query with PK and optionally filter by SK

### API Design
- **DO**: Keep Lambda functions focused and single-purpose
- **DO**: Validate inputs at the API Gateway level when possible
- **DO**: Return early and fail fast with clear error messages
- **DON'T**: Make synchronous calls between Lambdas - use events (SQS/EventBridge)

### Cost Optimization
This project is designed to be cost-effective:
- Use on-demand DynamoDB pricing (not provisioned) for unpredictable traffic
- Leverage AWS Free Tier (1M Lambda requests, 25GB DynamoDB storage, 50K Cognito MAUs)
- HTTP API Gateway is 3x cheaper than REST API Gateway
- **Always** consider cost impact when adding new AWS services

### Security
- **DO**: Use Cognito authorizer on all protected API endpoints
- **DO**: Validate user permissions (e.g., user is member of group before allowing operations)
- **DO**: Sanitize inputs to prevent injection attacks
- **DON'T**: Trust client-side validation alone
- **DON'T**: Expose internal IDs or implementation details in errors

## Development Phases

The project is being built in phases:

1. **Phase 1** (Weeks 1-2): Monorepo setup, auth, basic scaffold
2. **Phase 2** (Weeks 3-4): Groups CRUD, transactions, balance display
3. **Phase 3** (Weeks 5-6): Split calculator, settlement calculation
4. **Phase 4** (Weeks 7-8): Notifications, settlement flow
5. **Phase 5** (Week 9+): Open-source prep, CI/CD, documentation

When working on features, ensure they align with the current phase and don't introduce dependencies on future phases.

## Working with This Codebase

### When Adding Features
1. Check if shared logic exists in `/packages/shared` first
2. Define TypeScript types in shared package before implementation
3. Update API client in shared package for new endpoints
4. Implement backend Lambda functions with proper error handling
5. Test both web and mobile apps if shared code is modified

### When Modifying Database Schema
1. Review existing access patterns in this document
2. Ensure new patterns don't require table scans
3. Update DynamoDB table definitions in SST configuration
4. Consider migration strategy for existing data

### When Working with Auth
1. Use Cognito SDK directly (never the hosted UI)
2. Handle token refresh automatically in API client
3. Implement proper error handling for expired/invalid tokens
4. Test auth flow in both web and mobile apps

### When Optimizing
1. Profile before optimizing - don't guess at bottlenecks
2. Use CloudWatch metrics to identify slow Lambda functions
3. Consider DynamoDB caching only after confirming hot-key issues
4. Remember: premature optimization wastes money on AWS

## Important Constraints

- **Keep it serverless**: No EC2 instances, no long-running processes
- **Stay in free tier**: Design for zero cost at low usage
- **Minimize vendor lock-in**: Use standard patterns where possible, but embrace AWS-native services where they provide clear value
- **Open-source friendly**: Code should be easy for contributors to understand and run locally
- **Mobile-first UX**: Both apps should work offline where possible

## Common Pitfalls to Avoid

1. **Don't use REST API Gateway** - use HTTP API Gateway (3x cheaper)
2. **Don't use Aurora Serverless** - use DynamoDB on-demand (no minimum cost)
3. **Don't create custom authorizer Lambda** - use native Cognito authorizer
4. **Don't make settlement calculations synchronous** - always async via DynamoDB Streams
5. **Don't create separate API clients** - share one in the monorepo
6. **Don't store sensitive data in AsyncStorage** - use secure storage
7. **Don't add dependencies without checking bundle size impact**

## Testing Strategy

- Unit tests for business logic in `/packages/shared`
- Integration tests for Lambda functions with DynamoDB Local
- E2E tests for critical user flows (create group, add transaction, settle)
- Test both web and mobile when modifying shared code

## Deployment

- **Backend**: Deploy via SST (Ion) - infrastructure as code
- **Web**: AWS Amplify auto-deploys from GitHub main branch
- **Mobile**: EAS Build for TestFlight/Play Store beta builds
- **CI/CD**: GitHub Actions runs tests and deploys on merge to main

## Questions or Clarifications?

When uncertain about implementation details:
1. Refer to the Architecture.md document for detailed explanations
2. Check existing code patterns in the monorepo
3. Ask the user for clarification on business logic or UX decisions
4. Default to the simplest solution that follows established patterns
