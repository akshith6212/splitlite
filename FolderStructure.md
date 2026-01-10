---

# 🧱 Folder Structure

```txt
src/
 ├── handlers/
 │    ├── user/
 │    │    └── getMe.js
 │    ├── group/
 │    │    ├── createGroup.js
 │    │    └── listGroups.js
 │    └── expense/
 │         └── addExpense.js
 ├── libs/
 │    ├── db.js
 │    ├── auth.js
 │    ├── response.js
 │    └── errors.js
 ├── middleware/
 │    ├── withAuth.js
 │    └── withFeatures.js
 └── index.js
```

---

# 🧠 Big Picture First (IMPORTANT)

Think of your backend like a **restaurant** 🍽️

* **handlers/** → chefs (they cook one dish)
* **libs/** → kitchen tools (reused everywhere)
* **middleware/** → security + checks before cooking
* **index.js** → menu & routing

Each Lambda = **one handler function**.

---

# 📂 `handlers/` — Business Logic (THE HEART)

👉 **Each file here = one API endpoint**

These files:

* Read request data
* Call DB / services
* Return a response
* Do **NO auth logic**
* Do **NO formatting logic**

---

## `handlers/user/getMe.js`

📌 **Purpose**

* Fetch logged-in user profile
* Create user if first login

🧠 What it does:

1. Receives user ID from middleware
2. Queries `users` table
3. Inserts user if not exists
4. Returns profile JSON

💡 Why separate?

* Clean, small function
* Easy to test
* Reused across mobile + web

---

## `handlers/group/createGroup.js`

📌 **Purpose**

* Create a new group

🧠 Steps:

1. Get `user_id`
2. Insert into `groups`
3. Add creator to `group_members`
4. Return group info

---

## `handlers/group/listGroups.js`

📌 **Purpose**

* List all groups user belongs to

🧠 Steps:

1. Query `group_members`
2. Join with `groups`
3. Return list

---

## `handlers/expense/addExpense.js`

📌 **Purpose**

* Add an expense to a group

🧠 Steps:

1. Validate request
2. Insert expense
3. Insert splits
4. Trigger async notifications

---

# 📂 `libs/` — Shared Utilities (REUSE ZONE)

👉 **Pure helper logic — no business rules**

---

## `libs/db.js` – Database Connection

📌 **Why it exists**

* Lambda is stateless
* Opening DB connection per request is slow

🧠 What it does:

* Creates DB client
* Reuses it across invocations
* Exposes `query()` function

```js
let client;

export function getDb() {
  if (!client) client = createClient();
  return client;
}
```

---

## `libs/auth.js` – JWT Utilities

📌 **Why**

* Auth logic is tricky
* Must be consistent everywhere

🧠 Does:

* Verifies Cognito JWT
* Extracts user ID, email
* Returns safe user object

Used by middleware, not handlers.

---

## `libs/response.js` – API Responses

📌 **Why**

* API Gateway expects specific format
* You don’t want to repeat headers everywhere

🧠 Provides:

```js
success(data)
error(message, statusCode)
```

Ensures:

* CORS headers
* Consistent JSON format

---

## `libs/errors.js` – Custom Errors

📌 **Why**

* To avoid random `throw new Error()`
* Makes error handling predictable

Example:

```js
throw new UnauthorizedError();
throw new ValidationError("Amount missing");
```

---

# 📂 `middleware/` — Pre-checks (GATEKEEPERS)

👉 Runs **before** handlers

Think of middleware as:

> “Should this request even reach the handler?”

---

## `middleware/withAuth.js`

📌 **Purpose**

* Protect APIs

🧠 Steps:

1. Read Authorization header
2. Verify JWT
3. Attach `user` to request
4. Call handler

If invalid → block request

---

## `middleware/withFeatures.js`

📌 **Purpose**

* Enforce paid feature access

🧠 Steps:

1. Read required feature key
2. Check Redis / DB
3. Allow or deny

Example:

```js
withFeatures("export_csv")(handler)
```

---

# 📄 `index.js` — Entry Point (ROUTER)

📌 **Purpose**

* Connect API Gateway routes to handlers

Example:

```js
export const getMe = withAuth(getMeHandler);
export const createGroup = withAuth(createGroupHandler);
```

Why?

* Keeps handlers clean
* Centralizes middleware usage

---

# 🔄 Request Flow (VERY IMPORTANT)

Example: `POST /groups`

1. API Gateway
2. Lambda → `index.js`
3. `withAuth`
4. `createGroup.js`
5. `db.js`
6. `response.js`
7. Return JSON

---

# 🧠 Why This Structure Is Powerful

✅ Easy to scale
✅ Easy to test
✅ Easy to add paid features
✅ Easy to onboard new devs
✅ Avoids spaghetti code

---

# 🔥 If You Remember Only ONE Thing

> **Handlers = what your app does**
> **Libs = how it does it**
> **Middleware = who is allowed to do it**
