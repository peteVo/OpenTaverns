import React, { useEffect, useRef, useState } from 'react';
import './manage.css';

type Table = { code: string; gameId: string; host: string; seats: number; connected: number; bots: number; spectators: number; phase: string; created: number; paused: boolean };
const games: Record<string, string> = { hearthlands: 'Hearthlands', 'saigon-grid': 'Saigon Grid', blackout: 'Blackout', tidecall: 'Tidecall', werewolf: 'Werewolf', mosaic: 'Mosaic' };

async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Request failed.');
  return data;
}

export default function ManageTables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Table | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  async function refresh() {
    const data = await request<{ tables: Table[] }>('tables');
    setTables(data.tables);
    setAuthorized(true);
    return data.tables.length;
  }

  useEffect(() => {
    let live = true;
    const connect = async () => {
      const initialKey = new URLSearchParams(location.hash.slice(1)).get('key');
      if (initialKey) history.replaceState({}, '', location.pathname);
      setError('');
      try {
        if (initialKey) await request('login', 'POST', { key: initialKey });
        if (live) await refresh();
      } catch (e) {
        if (live && initialKey) setError((e as Error).message);
      } finally {
        if (live) setInitializing(false);
      }
    };
    void connect();
    window.addEventListener('hashchange', connect);
    return () => { live = false; window.removeEventListener('hashchange', connect); };
  }, []);

  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [selected]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await request('login', 'POST', { key }); setKey(''); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function refreshTables() {
    setRefreshing(true); setError(''); setNotice('');
    try {
      const count = await refresh();
      setNotice(`Register refreshed. ${count} ${count === 1 ? 'table' : 'tables'} saved.`);
    } catch (e) { setError((e as Error).message); }
    finally { setRefreshing(false); }
  }

  async function lockRegister() {
    setBusy(true); setError(''); setNotice('');
    try { await request('logout', 'POST'); setAuthorized(false); setTables([]); setNotice('The register is locked.'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`tables/${selected.code}`, 'DELETE');
      setNotice(`Table ${selected.code} was deleted.`);
      setSelected(null);
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <main className="management">
    <header><a className="brand" href="/">OPEN<span>TAVERNS</span></a><a href="/">Back to games ↗</a></header>
    <section className="management-intro"><span className="management-label">THE HOST'S REGISTER</span><h1>Your saved tables.</h1><p>Tables are saved automatically between server restarts. Reopen a table, or delete it when everyone has finished.</p></section>

    {initializing ? <section className="management-loading" role="status" aria-live="polite"><span className="management-label">PLEASE WAIT</span><h2>Opening the register…</h2></section> : !authorized ? <form className="management-login" onSubmit={login}>
      <h2>Host access</h2><p>Use the private management link printed when the server starts, or enter the key from that link.</p>
      <label>Management key<input type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" required maxLength={200} /></label>
      <button disabled={busy || !key.trim()} aria-busy={busy}>{busy ? 'Opening…' : 'Open the register →'}</button>
    </form> : <section className="management-register" aria-label="Saved tables">
      <div className="management-toolbar"><div><h2>{tables.length} saved {tables.length === 1 ? 'table' : 'tables'}</h2><p>Keep the invitation open while a table is still in use.</p></div><div>
        <button disabled={busy || refreshing} aria-busy={refreshing} onClick={() => void refreshTables()}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        <button disabled={busy || refreshing} onClick={() => void lockRegister()}>Lock register</button>
      </div></div>
      {refreshing && <p className="management-loading" role="status">Checking saved tables…</p>}
      {!tables.length && !refreshing && <div className="management-empty"><h3>The register is clear.</h3><p>Create a table from the collection. It will be saved automatically.</p><a href="/">Choose a game →</a></div>}
      {tables.map(table => <article className="management-table" key={table.code}>
        <div className="management-code"><span>TABLE</span><strong>{table.code}</strong><small>{new Date(table.created).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
        <div className="management-detail"><h3>{games[table.gameId] ?? table.gameId}</h3><p>Host: {table.host}</p><div className="management-counts"><span>{table.seats} {table.seats === 1 ? 'seat' : 'seats'}</span><span>{table.bots} {table.bots === 1 ? 'bot' : 'bots'}</span><span>{table.connected} connected</span><span>{table.spectators} spectator {table.spectators === 1 ? 'session' : 'sessions'}</span></div></div>
        <div className="management-status"><b>{table.phase === 'LOBBY' ? 'Gathering' : table.phase === 'GAME_OVER' || table.phase === 'MATCH_OVER' ? 'Finished' : table.paused ? 'Awaiting reconnect' : 'In progress'}</b>{!['LOBBY', 'GAME_OVER', 'MATCH_OVER'].includes(table.phase) && <span>{table.phase.replaceAll('_', ' ').toLowerCase()}</span>}</div>
        <div className="management-actions"><a href={`/t/${table.code}`}>Open table ↗</a><button disabled={busy || refreshing} onClick={() => { setError(''); setSelected(table); }}>Delete table</button></div>
      </article>)}
    </section>}

    {notice && <p className="management-notice" role="status" aria-live="polite">{notice}</p>}
    {error && <p className="management-error" role="alert">{error}</p>}
    <dialog ref={dialog} className="management-confirm" aria-labelledby="delete-title" onCancel={e => { if (busy) e.preventDefault(); }} onClose={() => setSelected(null)}>
      <span className="management-label">PERMANENT DELETION</span><h2 id="delete-title">Delete table {selected?.code}?</h2>
      <p>This removes the saved game and every seat. Anyone connected will leave the table, and its invitation will stop working. This cannot be undone.</p>
      <div><button disabled={busy} onClick={() => setSelected(null)} autoFocus>Keep table</button><button disabled={busy} className="management-delete" aria-busy={busy} onClick={() => void remove()}>{busy ? 'Deleting…' : `Delete ${selected?.code}`}</button></div>
      {error && <p role="alert" className="management-error">{error}</p>}
    </dialog>
  </main>;
}
