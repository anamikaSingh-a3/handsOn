import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const idle = { status: 'idle', data: null, error: null };

export default function Dashboard() {
  const navigate = useNavigate();
  const [blockState, setBlockState] = useState(idle);
  const [workerState, setWorkerState] = useState(idle);
  const [blockElapsed, setBlockElapsed] = useState(0);
  const [workerElapsed, setWorkerElapsed] = useState(0);

  // DB call results for each scenario
  const [blockDbCall, setBlockDbCall] = useState(null);
  const [workerDbCall, setWorkerDbCall] = useState(null);

  const blockTimer  = useRef(null);
  const workerTimer = useRef(null);

  const startElapsed = (setter, ref) => {
    const t = Date.now();
    ref.current = setInterval(() => setter(Date.now() - t), 50);
  };
  const stopElapsed = (setter, ref) => {
    clearInterval(ref.current);
    setter(0);
  };

  // ── Blocking task ───────────────────────────────────────────
  const runBlockingTask = async () => {
    setBlockState({ status: 'loading', data: null, error: null });
    setBlockDbCall(null);
    startElapsed(setBlockElapsed, blockTimer);
    const t = Date.now();
    try {
      const { data } = await api.get('/workers/blocking');
      stopElapsed(setBlockElapsed, blockTimer);
      setBlockState({ status: 'done', data: { ...data, clientMs: Date.now() - t }, error: null });
    } catch (err) {
      stopElapsed(setBlockElapsed, blockTimer);
      setBlockState({ status: 'error', data: null, error: err.message });
    }
  };

  // DB call attempted WHILE blocking task is running
  const fetchUsersWhileBlocking = async () => {
    setBlockDbCall({ status: 'pending', startedAt: Date.now() });
    const t = Date.now();
    try {
      const { data } = await api.get('/users');
      setBlockDbCall({ status: 'done', ms: Date.now() - t, count: data.count, users: data.users });
    } catch {
      setBlockDbCall({ status: 'error', ms: Date.now() - t });
    }
  };

  // ── Worker task ─────────────────────────────────────────────
  const runWorkerTask = async () => {
    setWorkerState({ status: 'loading', data: null, error: null });
    setWorkerDbCall(null);
    startElapsed(setWorkerElapsed, workerTimer);
    const t = Date.now();
    try {
      const { data } = await api.get('/workers/offload');
      stopElapsed(setWorkerElapsed, workerTimer);
      setWorkerState({ status: 'done', data: { ...data, clientMs: Date.now() - t }, error: null });
    } catch (err) {
      stopElapsed(setWorkerElapsed, workerTimer);
      setWorkerState({ status: 'error', data: null, error: err.message });
    }
  };

  // DB call attempted WHILE worker task is running
  const fetchUsersWhileWorker = async () => {
    setWorkerDbCall({ status: 'pending', startedAt: Date.now() });
    const t = Date.now();
    try {
      const { data } = await api.get('/users');
      setWorkerDbCall({ status: 'done', ms: Date.now() - t, count: data.count, users: data.users });
    } catch {
      setWorkerDbCall({ status: 'error', ms: Date.now() - t });
    }
  };

  return (
    <div style={s.page}>

      <div style={s.header}>
        <h2 style={s.title}>Blocking vs Worker Thread</h2>
        <button style={s.logoutBtn} onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>
          Logout
        </button>
      </div>

      <p style={s.subtitle}>
        Start a CPU task, then immediately click <strong>"Fetch Users from DB"</strong> to see if the server can handle it.
      </p>

      <div style={s.grid}>

        {/* ── LEFT: Blocking ── */}
        <div style={{ ...s.card, borderTop: '4px solid #ef4444' }}>
          <h3 style={{ color: '#ef4444', margin: 0 }}>Without Worker Thread</h3>
          <p style={s.desc}>
            Heavy task runs on the <strong>main thread</strong>. The DB call will be stuck waiting until the loop finishes.
          </p>

          <button style={{ ...s.btn, background: '#ef4444' }}
            onClick={runBlockingTask}
            disabled={blockState.status === 'loading'}>
            {blockState.status === 'loading'
              ? `Running… ${blockElapsed}ms`
              : 'Start Heavy Task'}
          </button>

          {/* DB call button — only useful while task is running */}
          <button style={{ ...s.dbBtn, opacity: blockState.status === 'loading' ? 1 : 0.4 }}
            onClick={fetchUsersWhileBlocking}
            disabled={blockState.status === 'done' || blockState.status === 'idle'}>
            Fetch Users from DB
          </button>

          <DbCallResult result={blockDbCall} blockedColor="#ef4444" />

          {blockState.status === 'done' && (
            <div style={s.summary}>
              <span>Heavy task done in</span>
              <strong style={{ color: '#ef4444' }}>{blockState.data.clientMs}ms</strong>
            </div>
          )}
        </div>

        {/* ── RIGHT: Worker ── */}
        <div style={{ ...s.card, borderTop: '4px solid #22c55e' }}>
          <h3 style={{ color: '#22c55e', margin: 0 }}>With Worker Thread</h3>
          <p style={s.desc}>
            Heavy task runs in a <strong>Worker Thread</strong>. DB call goes through immediately — main thread is free.
          </p>

          <button style={{ ...s.btn, background: '#22c55e' }}
            onClick={runWorkerTask}
            disabled={workerState.status === 'loading'}>
            {workerState.status === 'loading'
              ? `Running… ${workerElapsed}ms`
              : 'Start Heavy Task'}
          </button>

          {/* DB call button — lights up while task is running */}
          <button style={{ ...s.dbBtn, opacity: workerState.status === 'loading' ? 1 : 0.4 }}
            onClick={fetchUsersWhileWorker}
            disabled={workerState.status === 'done' || workerState.status === 'idle'}>
            Fetch Users from DB
          </button>

          <DbCallResult result={workerDbCall} blockedColor="#22c55e" />

          {workerState.status === 'done' && (
            <div style={s.summary}>
              <span>Heavy task done in</span>
              <strong style={{ color: '#22c55e' }}>{workerState.data.clientMs}ms</strong>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div style={s.steps}>
        <p style={s.stepsTitle}>How to test:</p>
        <ol style={s.ol}>
          <li>Click <strong style={{ color: '#ef4444' }}>Start Heavy Task</strong> on the left</li>
          <li>Immediately click <strong>"Fetch Users from DB"</strong> — it will hang until the task finishes</li>
          <li>Then try the same on the right — DB call returns instantly even while the task runs</li>
        </ol>
      </div>

    </div>
  );
}

function DbCallResult({ result, blockedColor }) {
  if (!result) return null;

  if (result.status === 'pending') {
    const waited = Date.now() - result.startedAt;
    return (
      <div style={s.dbResult}>
        <Spinner color="#facc15" />
        <span style={{ color: '#facc15', fontSize: 13 }}>
          Waiting for DB response… ({waited}ms so far — server is blocked)
        </span>
      </div>
    );
  }

  if (result.status === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ ...s.dbResult, background: '#0f2a1a', border: '1px solid #22c55e33' }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ fontSize: 13 }}>
            <div style={{ color: '#22c55e', fontWeight: 'bold' }}>
              DB responded in <strong>{result.ms}ms</strong>
            </div>
            <div style={{ color: '#aaa' }}>{result.count} user{result.count !== 1 ? 's' : ''} returned</div>
          </div>
        </div>
        {result.users?.length > 0 && (
          <div style={s.userList}>
            {result.users.map(u => (
              <div key={u._id} style={s.userRow}>
                <div style={s.avatar}>{u.name[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 'bold' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{u.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div style={{ ...s.dbResult, background: '#2a0f0f', border: '1px solid #ef444433' }}>
        <span style={{ fontSize: 18 }}>❌</span>
        <span style={{ color: '#ef4444', fontSize: 13 }}>DB call failed after {result.ms}ms</span>
      </div>
    );
  }
}

function Spinner({ color = '#fff' }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid #333', borderTop: `2px solid ${color}`,
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  );
}

const s = {
  page:      { maxWidth: 860, margin: '0 auto', padding: '32px 20px' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title:     { margin: 0, fontSize: 22 },
  logoutBtn: { padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  subtitle:  { color: '#888', marginBottom: 28, lineHeight: 1.6 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 },
  card:      { background: '#1e1e1e', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  desc:      { color: '#aaa', fontSize: 13, lineHeight: 1.6, margin: 0 },
  btn:       { padding: '10px', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: 14, fontVariantNumeric: 'tabular-nums' },
  dbBtn:     { padding: '10px', border: '2px dashed #6366f1', borderRadius: 6, background: 'transparent', color: '#6366f1', cursor: 'pointer', fontWeight: 'bold', fontSize: 13, transition: 'opacity 0.2s' },
  dbResult:  { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#1a1a1a', border: '1px solid #2a2a2a' },
  summary:   { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#aaa', paddingTop: 8, borderTop: '1px solid #2a2a2a' },
  steps:     { marginTop: 32, background: '#1a1a1a', borderRadius: 10, padding: '20px 24px' },
  stepsTitle: { margin: '0 0 10px', fontWeight: 'bold', color: '#aaa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  ol:        { margin: 0, paddingLeft: 20, color: '#aaa', fontSize: 14, lineHeight: 2 },
  userList:  { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', padding: '4px 0' },
  userRow:   { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#1a1a1a', borderRadius: 6 },
  avatar:    { width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 'bold', flexShrink: 0 },
};
