import { useState } from 'react';
import api from '../api/axios';

const initialState = { status: 'idle', data: null, error: null };

export default function WorkerDemo() {
  const [blocking, setBlocking] = useState(initialState);
  const [offload, setOffload] = useState(initialState);
  const [compare, setCompare] = useState(initialState);

  const run = async (endpoint, setter) => {
    setter({ status: 'loading', data: null, error: null });
    const start = Date.now();
    try {
      const { data } = await api.get(`/workers/${endpoint}`);
      setter({ status: 'done', data: { ...data, clientMs: Date.now() - start }, error: null });
    } catch (err) {
      setter({ status: 'error', data: null, error: err.message });
    }
  };

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Worker Threads Visualizer</h2>
      <p style={styles.subtitle}>
        See the difference between blocking the main thread vs offloading to a Worker Thread.
      </p>

      <div style={styles.grid}>

        {/* BLOCKING */}
        <Card
          title="Main Thread (Blocking)"
          description="Runs a 100M loop directly on the event loop. While this runs, the server cannot handle any other request."
          color="#ef4444"
          onRun={() => run('blocking', setBlocking)}
          state={blocking}
        />

        {/* WORKER OFFLOAD */}
        <Card
          title="Worker Thread (Non-blocking)"
          description="Runs the same 1B loop in a separate Worker Thread. The main thread stays free to handle other requests."
          color="#22c55e"
          onRun={() => run('offload', setOffload)}
          state={offload}
        />

        {/* COMPARE */}
        <Card
          title="Compare Both"
          description="Runs the same task on main thread first, then in a Worker Thread. Compare the timing side by side."
          color="#6366f1"
          onRun={() => run('compare', setCompare)}
          state={compare}
          isCompare
        />

      </div>
    </div>
  );
}

function Card({ title, description, color, onRun, state, isCompare }) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <h3 style={{ color }}>{title}</h3>
      <p style={styles.desc}>{description}</p>
      <button
        style={{ ...styles.btn, background: color }}
        onClick={onRun}
        disabled={state.status === 'loading'}
      >
        {state.status === 'loading' ? 'Running...' : 'Run Task'}
      </button>

      {state.status === 'loading' && (
        <div style={styles.loader}>
          <div style={styles.spinner} />
          <span>Processing... (server is working)</span>
        </div>
      )}

      {state.status === 'done' && !isCompare && (
        <Result data={state.data} color={color} />
      )}

      {state.status === 'done' && isCompare && (
        <CompareResult data={state.data} />
      )}

      {state.status === 'error' && (
        <p style={{ color: '#ef4444' }}>Error: {state.error}</p>
      )}
    </div>
  );
}

function Result({ data, color }) {
  return (
    <div style={styles.result}>
      <Stat label="Duration (server)" value={`${data.durationMs} ms`} color={color} />
      <Stat label="Duration (client)" value={`${data.clientMs} ms`} color={color} />
      <Stat label="Result" value={data.result?.toLocaleString()} color={color} />
      {data.blocked !== undefined && (
        <Stat label="Blocked main thread" value={data.blocked ? 'YES ⚠️' : 'NO ✅'} color={color} />
      )}
    </div>
  );
}

function CompareResult({ data }) {
  if (!data?.mainThread) return null;
  const { mainThread, workerThread } = data;
  return (
    <div>
      <div style={styles.compareRow}>
        <div style={{ ...styles.compareBox, borderColor: '#ef4444' }}>
          <strong style={{ color: '#ef4444' }}>Main Thread</strong>
          <p>{mainThread.durationMs} ms</p>
          <p>Blocked: YES ⚠️</p>
        </div>
        <div style={{ ...styles.compareBox, borderColor: '#22c55e' }}>
          <strong style={{ color: '#22c55e' }}>Worker Thread</strong>
          <p>{workerThread.durationMs} ms</p>
          <p>Blocked: NO ✅</p>
        </div>
      </div>
      <p style={styles.lesson}>
        Both computed the same result. The key difference: worker thread did NOT freeze the event loop.
      </p>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={styles.stat}>
      <span style={styles.label}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}

const styles = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '40px 20px' },
  title: { fontSize: 28, marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 32 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 },
  card: { background: '#1e1e1e', borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  desc: { color: '#aaa', fontSize: 13, lineHeight: 1.5 },
  btn: { padding: '10px 16px', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 'bold' },
  loader: { display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', fontSize: 13 },
  spinner: { width: 16, height: 16, border: '2px solid #555', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  result: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 },
  stat: { display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderBottom: '1px solid #2e2e2e' },
  label: { color: '#888' },
  compareRow: { display: 'flex', gap: 12, marginTop: 12 },
  compareBox: { flex: 1, border: '2px solid', borderRadius: 8, padding: 12, textAlign: 'center' },
  lesson: { fontSize: 12, color: '#aaa', marginTop: 12, lineHeight: 1.5 },
};
