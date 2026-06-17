import { useEffect, useState } from 'react';
import { Client, Databases, Query, Account } from 'appwrite';

const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT as string;
const PROJECT = import.meta.env.VITE_APPWRITE_PROJECT_ID as string;
const DB = (import.meta.env.VITE_APPWRITE_DATABASE_ID as string) || 'family_rights_main';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
const databases = new Databases(client);
const account = new Account(client);

type Tab = 'attorney' | 'exports' | 'ocr' | 'patterns' | 'reports' | 'public_cases';

export default function App() {
  const [tab, setTab] = useState<Tab>('attorney');
  const [me, setMe] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    account.get().then(setMe).catch(() => setMe(null));
  }, []);

  async function signIn() {
    await account.createEmailPasswordSession(email, password);
    const u = await account.get();
    setMe(u);
  }
  async function signOut() {
    await account.deleteSession('current');
    setMe(null);
  }

  if (!ENDPOINT || !PROJECT) {
    return (
      <div className="container">
        <h1>Family Rights — Admin Console</h1>
        <div className="card disclaimer">
          Configure <code>VITE_APPWRITE_ENDPOINT</code> and <code>VITE_APPWRITE_PROJECT_ID</code> in <code>.env</code>.
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="container">
        <h1>Family Rights — Admin Console</h1>
        <div className="card">
          <p className="muted">Sign in with an Appwrite account that has admin team membership.</p>
          <div className="row">
            <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button onClick={signIn}>Sign in</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Family Rights — Admin Console</h1>
        <div className="row">
          <span className="muted">{me.email}</span>
          <button className="secondary" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div className="disclaimer">
        Internal review only. Do not share user data outside the consented review purpose.
        Nothing surfaced here constitutes legal advice.
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <button className={tab === 'attorney' ? '' : 'secondary'} onClick={() => setTab('attorney')}>Attorney requests</button>
        <button className={tab === 'exports' ? '' : 'secondary'} onClick={() => setTab('exports')}>Recent exports</button>
        <button className={tab === 'ocr' ? '' : 'secondary'} onClick={() => setTab('ocr')}>OCR failures</button>
        <button className={tab === 'patterns' ? '' : 'secondary'} onClick={() => setTab('patterns')}>Patterns</button>
        <button className={tab === 'reports' ? '' : 'secondary'} onClick={() => setTab('reports')}>Content reports</button>
        <button className={tab === 'public_cases' ? '' : 'secondary'} onClick={() => setTab('public_cases')}>Public cases</button>
      </div>

      {tab === 'attorney' && <AttorneyRequests />}
      {tab === 'exports' && <RecentExports />}
      {tab === 'ocr' && <OcrFailures />}
      {tab === 'patterns' && <Patterns />}
      {tab === 'reports' && <ContentReports />}
      {tab === 'public_cases' && <PublicCases />}
    </div>
  );
}

function useList(collection: string, queries: string[] = []) {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    databases.listDocuments(DB, collection, queries.length ? queries : undefined)
      .then((r) => setRows(r.documents))
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);
  return { rows, err, setRows };
}

function AttorneyRequests() {
  const { rows, err, setRows } = useList('attorney_review_requests', [Query.orderDesc('createdAt'), Query.limit(50)]);
  async function setStatus(id: string, status: string) {
    await databases.updateDocument(DB, 'attorney_review_requests', id, { status });
    setRows((r) => r.map((x) => (x.$id === id ? { ...x, status } : x)));
  }
  return (
    <div className="card">
      <h2>Attorney review requests</h2>
      {err && <p className="muted">Error: {err}</p>}
      <table>
        <thead>
          <tr><th>Created</th><th>Case</th><th>Owner</th><th>Status</th><th>Notes</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.$id}>
              <td>{r.createdAt?.slice(0, 19).replace('T', ' ')}</td>
              <td>{r.caseId}</td>
              <td>{r.ownerId}</td>
              <td><span className={`badge ${r.status === 'completed' ? 'ok' : r.status === 'pending' ? 'warn' : ''}`}>{r.status}</span></td>
              <td>{r.notes}</td>
              <td className="row">
                <button onClick={() => setStatus(r.$id, 'matched')}>Mark matched</button>
                <button className="secondary" onClick={() => setStatus(r.$id, 'completed')}>Complete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentExports() {
  const { rows, err } = useList('exports', [Query.orderDesc('createdAt'), Query.limit(50)]);
  return (
    <div className="card">
      <h2>Recent exports</h2>
      {err && <p className="muted">Error: {err}</p>}
      <table>
        <thead><tr><th>Created</th><th>Case</th><th>File</th><th>Size</th><th>Docs</th><th>Expires</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.$id}>
              <td>{r.createdAt?.slice(0, 19).replace('T', ' ')}</td>
              <td>{r.caseId}</td>
              <td>{r.fileName}</td>
              <td>{Math.round((r.sizeBytes || 0) / 1024)} KB</td>
              <td>{r.documentCount}</td>
              <td>{r.expiresAt?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OcrFailures() {
  const { rows, err } = useList('documents', [Query.equal('ocrStatus', 'failed'), Query.limit(50)]);
  return (
    <div className="card">
      <h2>OCR failures</h2>
      {err && <p className="muted">Error: {err}</p>}
      <table>
        <thead><tr><th>Doc</th><th>Title</th><th>Error</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.$id}><td>{r.$id}</td><td>{r.title}</td><td><code>{r.ocrError}</code></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentReports() {
  const { rows, err, setRows } = useList('content_reports', [Query.orderDesc('createdAt'), Query.limit(100)]);
  async function setStatus(id: string, status: string, resolutionNote?: string) {
    const patch: any = { status };
    if (status === 'resolved' || status === 'dismissed') {
      patch.resolvedAt = new Date().toISOString();
      if (resolutionNote) patch.resolutionNote = resolutionNote;
    }
    await databases.updateDocument(DB, 'content_reports', id, patch);
    setRows((r) => r.map((x) => (x.$id === id ? { ...x, ...patch } : x)));
  }
  async function unpublishCase(caseId: string) {
    if (!confirm('Force-unpublish this case? It will be removed from public view immediately.')) return;
    await databases.updateDocument(DB, 'cases', caseId, {
      visibility: 'private',
      unpublishedAt: new Date().toISOString(),
    });
    alert('Case unpublished.');
  }
  return (
    <div className="card">
      <h2>Content reports</h2>
      <p className="muted">UGC reports submitted on public cases. Triage promptly to comply with Play Store policy.</p>
      {err && <p className="muted">Error: {err}</p>}
      <table>
        <thead>
          <tr><th>Created</th><th>Case</th><th>Reason</th><th>Reporter</th><th>Status</th><th>Details</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.$id}>
              <td>{r.createdAt?.slice(0, 19).replace('T', ' ')}</td>
              <td><code>{r.caseId}</code></td>
              <td><span className="badge warn">{r.reason}</span></td>
              <td>{r.reporterUserId || 'anonymous'}</td>
              <td><span className={`badge ${r.status === 'resolved' ? 'ok' : r.status === 'open' ? 'warn' : ''}`}>{r.status}</span></td>
              <td>{r.details || '—'}</td>
              <td className="row">
                <button onClick={() => setStatus(r.$id, 'reviewing')}>Reviewing</button>
                <button onClick={() => setStatus(r.$id, 'resolved', 'Content updated or removed.')}>Resolve</button>
                <button className="secondary" onClick={() => setStatus(r.$id, 'dismissed', 'No violation found.')}>Dismiss</button>
                <button className="secondary" onClick={() => unpublishCase(r.caseId)}>Force unpublish</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PublicCases() {
  const { rows, err, setRows } = useList('cases', [Query.equal('visibility', 'public'), Query.orderDesc('publishedAt'), Query.limit(100)]);
  async function forceUnpublish(id: string) {
    if (!confirm('Force-unpublish this case?')) return;
    await databases.updateDocument(DB, 'cases', id, {
      visibility: 'private',
      unpublishedAt: new Date().toISOString(),
    });
    setRows((r) => r.filter((x) => x.$id !== id));
  }
  return (
    <div className="card">
      <h2>Public cases</h2>
      <p className="muted">All cases currently visible in the public reference library.</p>
      {err && <p className="muted">Error: {err}</p>}
      <table>
        <thead><tr><th>Slug</th><th>Title</th><th>Owner</th><th>Reference?</th><th>Published</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.$id}>
              <td><code>{r.publicSlug}</code></td>
              <td>{r.publicTitle || r.title}</td>
              <td>{r.publishedBy || r.ownerId}</td>
              <td>{r.isReferenceCase ? '✓' : ''}</td>
              <td>{r.publishedAt?.slice(0, 10)}</td>
              <td><button className="secondary" onClick={() => forceUnpublish(r.$id)}>Force unpublish</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Patterns() {
  const { rows, err } = useList('pattern_matches', [Query.orderDesc('caseCount'), Query.limit(100)]);
  return (
    <div className="card">
      <h2>Coalition patterns</h2>
      {err && <p className="muted">Error: {err}</p>}
      <table>
        <thead><tr><th>Code</th><th>Label</th><th>Cases</th><th>Jurisdictions</th><th>Updated</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.$id}>
              <td><code>{r.code}</code></td>
              <td>{r.label}</td>
              <td>{r.caseCount}</td>
              <td>{(r.jurisdictions || []).join(', ')}</td>
              <td>{r.lastUpdated?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
