# Worker Threads

## The problem — Node.js is single-threaded

Node.js runs on a single thread. The event loop handles async I/O efficiently,
but CPU-heavy tasks block everything.

```
Normal async flow (I/O — non-blocking):
  Request 1: DB query → Node delegates to OS → handles Request 2
  OS finishes → Node picks up result → responds to Request 1
  ✅ Server stays responsive

CPU-heavy task (blocking):
  Request 1: fib(45) → Node starts computing on main thread
  Request 2: DB query → WAITING... main thread is busy
  Request 2: WAITING...
  Request 2: WAITING...
  fib(45) finishes → Request 1 responds
  Now Request 2 gets handled
  ❌ Server was blocked for the entire computation
```

This is what our app demonstrates.

---

## What are Worker Threads?

Worker Threads let you run JavaScript in **parallel threads** inside the same process.

```
Main Thread (event loop)
├── handles HTTP requests
├── handles DB queries
└── spawns Worker Thread ──→ Worker Thread
                               └── runs fib(45) on separate thread
                               ← main thread stays free ✅
```

- Workers run in separate threads — they don't block the main thread
- They share the same process memory (unlike cluster, which forks separate processes)
- They communicate with the main thread via `postMessage`
- They can share memory using `SharedArrayBuffer`

---

## Worker Threads vs Cluster

| Feature | Worker Threads | Cluster |
|---|---|---|
| Separate process? | No — same process | Yes — new OS process |
| Memory | Shared (SharedArrayBuffer) | Separate memory per process |
| Overhead | Low | Higher (process startup cost) |
| Use for | CPU-heavy tasks in parallel | Scaling across CPU cores (multiple servers) |
| Communication | postMessage (fast) | IPC (slightly slower) |

**Worker Threads** — when you have one CPU-heavy task to offload
**Cluster** — when you want to handle more HTTP requests by using all CPU cores

---

## When to use Worker Threads

```
USE Worker Threads for:               DON'T USE for:
──────────────────────                ─────────────
fib calculations                      DB queries (event loop handles this)
Image processing                      File reads (async I/O is fine)
Video encoding                        HTTP calls (async I/O is fine)
Cryptographic operations              Simple async work (Promises are enough)
Large data parsing (CSV, JSON)
Machine learning inference
```

---

## The implementation — how it works

### The main thread (workerThreads.js)

```js
// GET /api/workers/blocking — runs on MAIN THREAD (blocks)
router.get('/blocking', (_req, res) => {
  const start = Date.now();

  function fib(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2); // recursive — exponentially expensive
  }

  const result = fib(45);
  // fib(45) takes several seconds
  // During this time, the event loop is FROZEN
  // Any other request that comes in will WAIT until this finishes

  res.json({ result, durationMs: Date.now() - start, blocked: true });
});

// GET /api/workers/offload — runs in WORKER THREAD (non-blocking)
router.get('/offload', (_req, res) => {
  const start = Date.now();
  const workerPath = join(__dirname, '../workers/heavyTask.js');

  // Spawn a new worker thread
  const worker = new Worker(workerPath);
  // Main thread is now FREE — returns to event loop immediately
  // Worker thread starts running heavyTask.js in parallel

  // Listen for result from worker
  worker.on('message', (data) => {
    // Worker finished — now send the HTTP response
    res.json({
      result: data.result,
      durationMs: Date.now() - start,
      blocked: false,
    });
  });

  worker.on('error', (err) => {
    res.status(500).json({ message: err.message });
  });
  // Function returns here — event loop handles other requests while worker runs
});
```

### The worker file (workers/heavyTask.js)

```js
// This file runs in a SEPARATE THREAD — not the main thread
import { parentPort } from 'worker_threads';

// Same computation as the blocking route — fair comparison
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

const result = fib(45);
// This blocks THIS thread — but not the main thread
// Main thread is free to handle other requests while this runs

// Send result back to the main thread
if (parentPort) {
  parentPort.postMessage({ result });
}
// Worker thread exits after this
```

---

## The communication flow

```
Browser clicks "Start Heavy Task (Worker)"
        ↓
GET /api/workers/offload → main thread
        ↓
new Worker(heavyTask.js)  ← spawns worker thread
        ↓
Main thread returns to event loop  ← FREE NOW
        │                                    ↓
        │                           Worker thread: fib(45)
        │                           [several seconds...]
        │
Browser clicks "Fetch Users from DB" ← while fib is running
        ↓
GET /api/users → main thread handles it immediately ✅
        ↓
MongoDB query → response → browser shows users
        │
        │   (worker still running fib in background)
        │
Worker finishes fib(45)
        ↓
parentPort.postMessage({ result })
        ↓
Main thread's worker.on('message') fires
        ↓
res.json({ result }) → browser shows fib result
```

---

## Why they must run the same computation

Both routes run `fib(45)` — the same algorithm.

This is important for a fair comparison:
```
/blocking  → fib(45) on main thread  → blocks event loop
/offload   → fib(45) on worker thread → main thread stays free
```

If they ran different algorithms (one fast, one slow), you'd be comparing
computation speed — not the blocking vs non-blocking behavior.
Same input, same algorithm, different thread = fair comparison.

---

## workerData — passing data to workers

```js
// In the route — pass data to worker
const worker = new Worker(workerPath, {
  workerData: { limit: 1_000_000_000, userId: '123' }
});

// In heavyTask.js — read the data
import { workerData, parentPort } from 'worker_threads';
console.log(workerData.limit);    // 1000000000
console.log(workerData.userId);   // '123'
```

Use `workerData` to pass configuration or input to the worker at startup.
For ongoing communication, use `postMessage` back and forth.

---

## SharedArrayBuffer — sharing memory between threads

Normally, each worker gets a copy of data (structured clone).
For large data, copying is expensive. SharedArrayBuffer lets threads share memory.

```js
// Main thread
const shared = new SharedArrayBuffer(4); // 4 bytes
const view = new Int32Array(shared);
view[0] = 42;

const worker = new Worker('./worker.js', { workerData: { shared } });

// Worker thread
import { workerData } from 'worker_threads';
const view = new Int32Array(workerData.shared);
console.log(view[0]); // 42 — same memory, no copy
view[0] = 100;        // main thread sees this change too
```

Be careful with SharedArrayBuffer — concurrent writes can cause race conditions.
Use `Atomics` for thread-safe operations.

---

## The UI demonstration

Our frontend shows two panels side by side:

**Left panel (Without Worker Thread):**
1. Click "Start Heavy Task" → calls `/api/workers/blocking`
2. While running, click "Fetch Users from DB" → calls `/api/users`
3. The DB call hangs — server is blocked by fib(45) on main thread
4. Both respond only after fib(45) finishes

**Right panel (With Worker Thread):**
1. Click "Start Heavy Task" → calls `/api/workers/offload`
2. While running, click "Fetch Users from DB" → calls `/api/users`
3. DB call returns immediately — main thread is free ✅
4. fib(45) finishes later — worker result arrives separately

This makes the blocking vs non-blocking behavior **visible** in real time.
