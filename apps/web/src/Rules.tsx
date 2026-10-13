import { useEffect, useRef, useState } from 'react';
import { rules as hearthlandsRules } from '@opentaverns/hearthlands/rules';
import { rules as saigonGridRules } from '@opentaverns/saigon-grid/rules';
import { rules as blackoutRules } from '@opentaverns/blackout/rules';
import { rules as tidecallRules } from '@opentaverns/tidecall/rules';
import { rules as werewolfRules } from '@opentaverns/werewolf/rules';
import './rules.css';

export type RulesGame = 'hearthlands' | 'saigon-grid' | 'blackout' | 'tidecall' | 'werewolf';
type Section = { id: string; title: string; paragraphs: string[]; example?: string };
type Rules = { title: string; summary: string; quick: string[]; sections: Section[] };
const content: Record<RulesGame, Rules> = { hearthlands: hearthlandsRules, 'saigon-grid': saigonGridRules, blackout: blackoutRules, tidecall: tidecallRules, werewolf:werewolfRules };

export function RulesSheet({ gameId, section, onClose }: { gameId: RulesGame; section?: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState(section || 'top');
  useEffect(() => { ref.current?.showModal(); if (section && section !== 'top') requestAnimationFrame(() => ref.current?.querySelector(`#rules-${section}`)?.scrollIntoView({ block: 'start' })); }, [section]);
  function go(id: string) { setCurrent(id); ref.current?.querySelector(`#rules-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  const rules = content[gameId];
  return <dialog ref={ref} className={`ot-rules ot-rules-${gameId}`} aria-label={`${rules.title} rules`} onClose={onClose}><div className="ot-rules-head"><span>OPEN TAVERNS / HOW TO PLAY</span><button onClick={() => ref.current?.close()} aria-label="Close rules">Close ×</button></div><div className="ot-rules-layout"><nav aria-label="Rules sections"><button className={current === 'top' ? 'active' : ''} onClick={() => go('top')}>Quick rules</button>{rules.sections.map(item => <button key={item.id} className={current === item.id ? 'active' : ''} onClick={() => go(item.id)}>{item.title}</button>)}</nav><article><section id="rules-top"><span className="ot-rules-kicker">THE FIELD GUIDE</span><h2>{rules.title}</h2><p className="ot-rules-summary">{rules.summary}</p><h3>Quick rules</h3><ol>{rules.quick.map(line => <li key={line}>{line}</li>)}</ol></section>{rules.sections.map(item => <section key={item.id} id={`rules-${item.id}`}><h3>{item.title}</h3>{item.paragraphs.map(text => <p key={text}>{text}</p>)}{item.example && <aside>{item.example}</aside>}</section>)}<button className="ot-rules-top" onClick={() => go('top')}>↑ Back to quick rules</button></article></div></dialog>;
}
export function RulesButton({ gameId, label = 'Rules', className }: { gameId: RulesGame; label?: string; className?: string }) { const [open, setOpen] = useState(false); return <><button className={className} onClick={() => setOpen(true)}>{label}</button>{open && <RulesSheet gameId={gameId} onClose={() => setOpen(false)}/>}</>; }
