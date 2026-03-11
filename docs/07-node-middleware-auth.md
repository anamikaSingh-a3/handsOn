# Node.js, Middleware, Authentication & Authorization

## What is Node.js?

Node.js is a JavaScript runtime built on Chrome's V8 engine.
It lets you run JavaScript on the server — outside the browser.

### The Event Loop — why Node is fast for I/O

Node.js is **single-threaded** — it runs on one thread.
But it handles thousands of concurrent requests efficiently using the **event loop**.

```
Request 1: "Fetch users from DB"
  Node sends DB query → doesn't wait → moves to next request

Request 2: "Get profile"
  Node sends another DB query → doesn't wait → moves to next request

DB responds to Request 1 → event loop picks it up → sends response
DB responds to Request 2 → event loop picks it up → sends response
```

Node never blocks waiting for I/O (database queries, file reads, API calls).
It delegates those to the OS and handles the response when it's ready.

```
Good for:           Bad for:
────────────        ────────────
API servers         CPU-heavy tasks (image processing, video encoding)
Real-time apps      Large number crunching
Chat applications   → Use Worker Threads for these (see docs/08-worker-threads.md)
Streaming data
```

---

## Express.js

Express is a minimal web framework for Node.js.
It handles HTTP requests and lets you define routes and middleware.

```js
import express from 'express';
const app = express();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
```

### req and res

Every route handler receives two objects:

```js
(req, res) => { ... }
```

**`req` (request)** — what came IN from the client:
```js
req.body        // POST body (JSON data sent by client)
req.params      // URL params → /users/:id → req.params.id
req.query       // Query string → /users?page=2 → req.query.page
req.headers     // HTTP headers (Authorization, Content-Type, etc.)
req.user        // custom — set by auth middleware
```

**`res` (response)** — what you send BACK to the client:
```js
res.json({ data })      // send JSON response
res.status(404).json()  // set status code + send JSON
res.send('text')        // send plain text
```

---

## Middleware — the core concept

Middleware is a function that runs **between** the request arriving and the response being sent.

```
Request → middleware 1 → middleware 2 → middleware 3 → Route Handler → Response
```

Every middleware function receives `(req, res, next)`:
- `req` — the request object
- `res` — the response object
- `next` — call this to pass to the next middleware

```js
const myMiddleware = (req, res, next) => {
  console.log('Request came in:', req.method, req.url);
  next(); // pass to the next middleware or route handler
  // if you don't call next(), the request hangs forever
};

app.use(myMiddleware); // apply to all routes
```

### Built-in middleware we use

```js
app.use(cors());
// Allows cross-origin requests
// WHY: Browser blocks requests to a different origin by default
// Without this, frontend (localhost:5173) can't call backend (localhost:3001)

app.use(express.json());
// Parses incoming JSON request bodies
// WHY: Without this, req.body is undefined for POST requests with JSON

app.use(express.urlencoded({ extended: true }));
// Parses form-encoded data (HTML form submissions)

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
// Custom logger — logs every incoming request
// _res = unused parameter (underscore prefix = convention for unused)
```

### Middleware order matters

Express runs middleware in the order it's registered.
If you put a middleware after a route, it won't run for that route.

```js
app.use(express.json());  // ← must be BEFORE routes that read req.body
app.post('/register', handler);
```

---

## Authentication vs Authorization

These are different concepts — commonly confused.

```
Authentication: WHO are you?
  → "I am Anamika, here is my password"
  → Verifies identity

Authorization: WHAT are you allowed to do?
  → "Anamika is logged in, but can she access /admin?"
  → Verifies permissions
```

In our app:
- **Authentication** — login with email/password → get a JWT token
- **Authorization** — send JWT token with requests → middleware verifies it

---

## JWT (JSON Web Token)

A JWT is a self-contained token that proves who you are.
It's a string split into 3 parts separated by dots:

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyJ9.abc123signature
      ↑ header              ↑ payload        ↑ signature
```

- **Header** — algorithm used (HS256)
- **Payload** — data inside (user ID, expiry) — base64 encoded, NOT encrypted
- **Signature** — HMAC of header + payload using your secret key

The signature is what makes it secure. Anyone can read the payload,
but only someone with the `JWT_SECRET` can create a valid signature.

```
Server creates token:
  jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' })
  → "Here's your token, valid for 7 days"

Client stores it (localStorage) and sends it with every request:
  Authorization: Bearer eyJhbGc...

Server verifies:
  jwt.verify(token, JWT_SECRET)
  → "Valid token, user ID is 123"
  → or throws error if invalid/expired
```

**Why JWT over sessions?**
Sessions store state on the server (requires DB lookup per request).
JWTs are stateless — the token contains everything, no DB lookup needed.

---

## Auth routes (how it works)

```js
// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email taken' });

  // Hash password before saving
  // WHY: Never store plain text passwords
  // bcrypt adds a random salt + hashes — even same password = different hash
  const hashed = await bcrypt.hash(password, 10);
  // 10 = salt rounds — higher = slower but more secure. 10 is standard.

  const user = await User.create({ name, email, password: hashed });

  // Create JWT token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });

  res.status(201).json({ token });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  // Compare plain password with stored hash
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });

  res.json({ token });
});
```

---

## Auth Middleware (how protected routes work)

```js
// middleware/authMiddleware.js
export const protect = async (req, res, next) => {
  // 1. Get token from Authorization header
  const authHeader = req.headers.authorization;
  // Client sends: "Authorization: Bearer eyJhbGc..."

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token' });
  }

  const token = authHeader.split(' ')[1]; // get just the token part

  try {
    // 2. Verify the token using our secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // If invalid or expired → throws error → caught below

    // 3. Find user in DB and attach to req
    const id = typeof decoded === 'object' ? decoded.id : null;
    req.user = await User.findById(id).select('-password');
    // req.user is now available in all subsequent middleware and route handlers

    next(); // pass to the protected route handler
  } catch (err) {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};
```

### Using the middleware on routes

```js
// Apply to a single route
app.get('/api/me', protect, (req, res) => {
  res.json({ user: req.user }); // req.user set by protect middleware
});

// Apply to all routes in a router
app.use('/api/admin', protect, adminRoutes);
// Every route under /api/admin requires a valid token
```

---

## Password hashing with bcrypt

```js
// Hashing (at registration)
const hashed = await bcrypt.hash('mypassword123', 10);
// → '$2b$10$randomsalthereXXXXXXXXXXhash...'

// Comparing (at login)
const match = await bcrypt.compare('mypassword123', hashed);
// → true or false
```

**Why not use crypto or MD5?**
- MD5/SHA1 are fast — fast = easy to brute force
- bcrypt is intentionally slow — 10 salt rounds = ~100ms per hash
- bcrypt adds a unique salt automatically — same password = different hash every time
- Rainbow table attacks don't work because of the salt

---

## The full auth flow

```
REGISTRATION
────────────
Client sends: { name, email, password }
  ↓
Server hashes password with bcrypt
  ↓
Server saves user to MongoDB
  ↓
Server creates JWT signed with JWT_SECRET
  ↓
Client receives token → stores in localStorage

LOGIN
─────
Client sends: { email, password }
  ↓
Server finds user by email
  ↓
bcrypt.compare(plain, hashed) → true/false
  ↓
Server creates JWT → client stores it

PROTECTED REQUEST
─────────────────
Client sends: Authorization: Bearer <token>
  ↓
protect middleware:
  jwt.verify(token, JWT_SECRET) → decoded payload
  User.findById(decoded.id) → attaches to req.user
  next()
  ↓
Route handler has access to req.user
```

---

## HTTP status codes used in auth

| Code | Meaning | When to use |
|---|---|---|
| 200 | OK | Successful login |
| 201 | Created | Successful registration |
| 400 | Bad Request | Missing fields, email taken |
| 401 | Unauthorized | Wrong password, invalid token |
| 403 | Forbidden | Valid token but no permission |
| 500 | Server Error | Unexpected error |
