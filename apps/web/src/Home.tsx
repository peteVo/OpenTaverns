import { useRef } from 'react';
import { RulesButton, type RulesGame } from './Rules';

const games: { id: RulesGame; name: string; players: string; genre: string; description: string; cover: string }[] = [
  { id: 'hearthlands', name: 'Hearthlands', players: '3–6', genre: 'Frontier strategy', description: 'Build trails and settlements across a shared landscape.', cover: 'hearth' },
  { id: 'saigon-grid', name: 'Saigon Grid', players: '2–6', genre: 'City & negotiation', description: 'Buy streets, compete at auction, and shape a changing city.', cover: 'grid' },
  { id: 'blackout', name: 'Blackout', players: '5–10', genre: 'Hidden-role crisis', description: 'Keep the city running. Decide who you can trust.', cover: 'blackout' },
  { id: 'tidecall', name: 'Tidecall', players: '3–6', genre: 'Forecast & trick-taking', description: 'Read the changing Tide and call your hand precisely.', cover: 'tidecall' },
  { id: 'werewolf', name: 'Werewolf', players: '8–18', genre: 'Social deduction', description: 'A quiet village, secret characters, and a moderator built in.', cover: 'werewolf' },
  { id: 'mosaic', name: 'Mosaic', players: '2–4', genre: 'Tile drafting & patterns', description: 'Choose a pair of ceramics. Make a composition of your own.', cover: 'mosaic' },
  { id: 'wildways', name: 'Wildways', players: '2–5', genre: 'Tile placement & networks', description: 'Lay a living landscape. Connect habitats, trails and streams.', cover: 'wildways' },
];

type Props = {
  gameId: RulesGame; setGameId: (id: RulesGame) => void;
  pacing: 'RELAXED' | 'STANDARD' | 'FAST'; setPacing: (pace: Props['pacing']) => void;
  name: string; setName: (name: string) => void;
  code: string; codeInput: string; setCodeInput: (code: string) => void;
  spectator: boolean; setSpectator: (watch: boolean) => void;
  loading: boolean; error: string; create: () => Promise<void>; join: () => Promise<void>;
};

function GameMark({ game }: { game: RulesGame }) {
  return <svg className="edition-art" viewBox="0 0 240 160" fill="none" aria-hidden="true">
    {game === 'hearthlands' && <g stroke="currentColor" strokeWidth="2"><path d="m54 25 38-22 38 22v44l-38 22-38-22zm76 0 38-22 38 22v44l-38 22-38-22zM92 91l38-22 38 22v44l-38 22-38-22z"/><path d="m54 69 38 22v44m38-66V25m0 110 38-22" strokeWidth="5"/><circle cx="92" cy="91" r="7" fill="currentColor"/><circle cx="130" cy="25" r="7" fill="currentColor"/></g>}
    {game === 'saigon-grid' && <g stroke="currentColor"><path d="M30 22h180v116H30zM70 22v116m50-116v116m50-116v116M30 60h180M30 100h180" strokeWidth="1.5"/><path d="m178 0-27 45 25 38-33 77" strokeWidth="15" opacity=".4"/>{[[30,22],[120,22],[210,60],[170,138],[70,138],[30,100]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" fill="currentColor"/>)}</g>}
    {game === 'blackout' && <g stroke="currentColor" strokeWidth="2"><path d="M50 40h140v80H50zM50 40l70 40 70-40M50 120l70-40 70 40"/>{[[50,40],[190,40],[50,120],[190,120]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="16"/><circle cx={x} cy={y} r="6" fill="currentColor"/></g>)}<circle cx="120" cy="80" r="9" fill="currentColor"/></g>}
    {game === 'tidecall' && <g stroke="currentColor" strokeWidth="2"><g transform="translate(47 23) rotate(-12 34 55)"><rect width="68" height="110" rx="6"/><path d="M13 52q10-17 20 0t20 0M13 65q10-17 20 0t20 0"/></g><g transform="translate(126 21) rotate(12 34 55)"><rect width="68" height="110" rx="6"/><circle cx="34" cy="55" r="17"/><path d="M34 28v-8m0 70v-8M7 55H0m68 0h-8"/></g></g>}
    {game === 'werewolf' && <g stroke="currentColor" strokeWidth="2"><path d="M136 15a43 43 0 1 0 40 63 36 36 0 0 1-40-63Z" fill="currentColor" opacity=".65"/><path d="M28 145V98l28-20 28 20v47m-15 0v-24H43v24m50 0v-36l24-18 24 18v36m12 0V97l28-21 28 21v48M16 146h210"/></g>}
    {game === 'mosaic' && <g>{Array.from({length:9},(_,i)=><g key={i} transform={'translate('+(48+(i%3)*49)+' '+(10+Math.floor(i/3)*49)+')'}><rect width="43" height="43" rx="3" fill={['#356b8a','#4b7458','#bb624a','#bd903a','#866c93'][i%5]}/><path d={i%2?'m12 12 19 19m0-19L12 31':'M12 12h19v19H12z'} stroke="#f5efdf" strokeWidth="2"/></g>)}</g>}
    {game === 'wildways' && <g stroke="currentColor" strokeWidth="2"><g fill="#526e4a"><path d="m42 40 18-30 18 30-18 30z"/><path d="m82 68 18-30 18 30-18 30z"/><path d="m122 40 18-30 18 30-18 30z"/><path d="m162 68 18-30 18 30-18 30z"/></g><g fill="none" stroke="#cfbd7d" strokeWidth="4"><path d="m60 40 40 28 40-28 40 28"/><path d="M60 40v52l40-24 40 24V40"/></g><g fill="#d6aa6a" stroke="#413d2a"><circle cx="60" cy="40" r="6"/><circle cx="100" cy="68" r="6"/><circle cx="140" cy="40" r="6"/><circle cx="180" cy="68" r="6"/></g><path d="m48 111 20-15 19 13 21-16 20 15 19-13 24 16" stroke="#b4d3d2" strokeWidth="5" fill="none"/></g>}
  </svg>;
}

export default function Home(props: Props) {
  const { gameId, setGameId, name, setName, code, codeInput, setCodeInput, pacing, setPacing, loading, error, spectator, setSpectator, create, join } = props;
  const submitting = useRef(false);
  async function enter(joinTable: boolean) { if (submitting.current) return; submitting.current = true; try { await (joinTable ? join() : create()); } finally { submitting.current = false; } }
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const selected = games.find(game => game.id === gameId)!;
  function choose(id: RulesGame) { setGameId(id); nameRef.current?.focus({ preventScroll: true }); document.getElementById('table-entry')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); }
  return <main className="home">
    <a className="skip-link" href="#table-entry">Skip to create or join a table</a>
    <header className="home-header"><a className="brand" href="/">OPEN<span>TAVERNS</span></a><nav aria-label="Main navigation"><a href="#collection">The games</a><a href="#table-entry" onClick={() => codeRef.current?.focus()}>Join a table</a></nav></header>
    <section className="home-stage" aria-label="Welcome to OpenTaverns">
        <div className="home-copy"><h1>Good games.<br/>Great company.</h1><p>Board games, online, together.<br/>Pick a game, share a link, pull up a chair.</p><a className="home-explore" href="#collection">Find your next game <span aria-hidden="true">↓</span></a><p className="home-footnote">Seven games. No accounts. Just friends.</p></div>
      <section className="home-entry" id="table-entry" aria-labelledby="entry-heading"><div className="entry-intro"><h2 id="entry-heading">{code ? 'Your seat is waiting.' : 'Make an evening of it.'}</h2><p>{code ? 'Enter your name to join this invitation.' : 'Start a new table or join your friends.'}</p></div>
        <form className="entry-form" aria-busy={loading} onSubmit={event => { event.preventDefault(); const submitter = (event.nativeEvent as SubmitEvent).submitter; void enter(!!code || submitter?.getAttribute('name') === 'join'); }}>
          <label>Your name<input ref={nameRef} value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="What should friends call you?" autoComplete="nickname" aria-describedby={error ? 'entry-error' : undefined}/></label>
          {!code && <><label>Choose a game<select value={gameId} onChange={event => setGameId(event.target.value as RulesGame)}>{games.map(game => <option key={game.id} value={game.id}>{game.name} · {game.players} players</option>)}</select></label>{['blackout','tidecall','werewolf','mosaic','wildways'].includes(gameId) && <label>Table pace<select value={pacing} onChange={event => setPacing(event.target.value as Props['pacing'])}><option value="RELAXED">Relaxed · generous discussion</option><option value="STANDARD">Standard · steady pace</option><option value="FAST">Fast · short windows</option></select></label>}<div className="entry-game-note"><span>{selected.players} players</span><RulesButton gameId={gameId} label="How to play"/></div><button className="primary-button" type="submit" name="create" disabled={loading}>{loading ? 'Opening your table…' : 'Create a table'}<span aria-hidden="true">↗</span></button></>}
          <div className="join-divider">{code ? 'Your invitation' : 'Have an invitation?'}</div>
          <div className="join-row"><input ref={codeRef} aria-label="Table code" value={code || codeInput} readOnly={!!code} maxLength={6} onChange={event => setCodeInput(event.target.value.toUpperCase())} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!loading) void enter(true); } }} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="TABLE CODE"/><button type="submit" name="join" disabled={loading}>{loading ? 'Joining…' : 'Join table →'}</button></div>
          <label className="watch-option"><input type="checkbox" checked={spectator} onChange={event => setSpectator(event.target.checked)}/>Watch as spectator</label>
          {error && <p className="error" id="entry-error" role="alert">{error}</p>}
        </form>
      </section>
    </section>
    <section className="home-collection" id="collection" aria-labelledby="collection-heading"><div className="collection-heading"><h2 id="collection-heading">A table for every kind of evening.</h2><p>A little strategy. A little suspense.<br/>Something to bring everyone together.</p></div><div className="game-shelf">{games.map(game => <article className={'game-edition '+game.cover+'-edition'} key={game.id}><button className={'game-volume '+game.cover+'-volume '+(gameId === game.id ? 'chosen' : '')} aria-pressed={gameId === game.id} onClick={() => choose(game.id)}><GameMark game={game.id}/><span className="volume-title">{game.name}</span><span className="volume-meta">{game.players} players · {game.genre}</span><span className="volume-description">{game.description}</span><span className="volume-action">{gameId === game.id ? 'Selected' : 'Choose '+game.name}<span aria-hidden="true">↗</span></span></button><RulesButton gameId={game.id} label={'How to play '+game.name} className="edition-rules"/></article>)}</div></section>
    <footer className="home-footer"><span>Good company makes the game.</span><a href="/manage">Host register ↗</a></footer>
  </main>;
}
