import { useEffect, useRef, useState } from 'react';
import { rules as hearthlandsRules } from '@opentaverns/hearthlands/rules';
import { rules as saigonGridRules } from '@opentaverns/saigon-grid/rules';
import { rules as blackoutRules } from '@opentaverns/blackout/rules';
import { rules as tidecallRules } from '@opentaverns/tidecall/rules';
import { rules as werewolfRules } from '@opentaverns/werewolf/rules';
import { rules as mosaicRules } from '@opentaverns/mosaic/rules';
import { rulesByLanguage as wildwaysRulesByLanguage } from '@opentaverns/wildways/rules';
import './rules.css';

export type RulesGame = 'hearthlands' | 'saigon-grid' | 'blackout' | 'tidecall' | 'werewolf' | 'mosaic' | 'wildways';
export type RulesLocale = 'en' | 'de' | 'vi';
type Section = { id: string; title: string; paragraphs: readonly string[]; example?: string };
type Rules = { title: string; summary: string; quick: readonly string[]; sections: readonly Section[] };
const content: Record<Exclude<RulesGame, 'wildways'>, Rules> = { hearthlands: hearthlandsRules, 'saigon-grid': saigonGridRules, blackout: blackoutRules, tidecall: tidecallRules, werewolf: werewolfRules, mosaic: mosaicRules };
const labels: Record<RulesLocale, { eyebrow: string; close: string; nav: string; quick: string; back: string; rules: string; details: string }> = {
  en: { eyebrow: 'OPEN TAVERNS / HOW TO PLAY', close: 'Close', nav: 'Rules sections', quick: 'Quick rules', back: '↑ Back to quick rules', rules: 'rules', details: 'rule details' },
  de: { eyebrow: 'OPEN TAVERNS / SPIELANLEITUNG', close: 'Schließen', nav: 'Regelabschnitte', quick: 'Kurzregeln', back: '↑ Zurück zu den Kurzregeln', rules: 'Regeln', details: 'Regeldetails' },
  vi: { eyebrow: 'OPEN TAVERNS / CÁCH CHƠI', close: 'Đóng', nav: 'Các mục luật chơi', quick: 'Luật nhanh', back: '↑ Trở lại luật nhanh', rules: 'luật chơi', details: 'chi tiết luật chơi' },
};

export function RulesSheet({ gameId, section, onClose, locale = 'en' }: { gameId: RulesGame; section?: string; onClose: () => void; locale?: RulesLocale }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState(section || 'top');
  const rules: Rules = gameId === 'wildways' ? wildwaysRulesByLanguage[locale] : content[gameId];
  const text = labels[locale];

  useEffect(() => {
    const dialog = ref.current;
    const article = dialog?.querySelector('article');
    if (!dialog || !article) return;
    if (!dialog.open) dialog.showModal();

    const updateCurrent = () => {
      const marker = article.getBoundingClientRect().top + 34;
      const sections = Array.from(article.querySelectorAll<HTMLElement>('[data-rules-section]'));
      const active = [...sections].reverse().find(item => item.getBoundingClientRect().top <= marker) ?? sections[0];
      if (active) setCurrent(active.dataset.rulesSection || 'top');
    };
    article.addEventListener('scroll', updateCurrent, { passive: true });
    requestAnimationFrame(() => {
      if (section && section !== 'top') {
        const target = dialog.querySelector<HTMLElement>(`#rules-${CSS.escape(section)}`);
        target?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
      updateCurrent();
    });
    return () => article.removeEventListener('scroll', updateCurrent);
  }, [section]);

  function go(id: string) {
    const target = ref.current?.querySelector<HTMLElement>(`#rules-${CSS.escape(id)}`);
    target?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    setCurrent(id);
  }

  return <dialog ref={ref} className={`ot-rules ot-rules-${gameId}`} aria-label={`${rules.title} ${text.rules}`} onClose={onClose}>
    <div className="ot-rules-head"><span>{text.eyebrow}</span><button type="button" autoFocus onClick={() => ref.current?.close()} aria-label={`${text.close} ${text.rules}`}>{text.close} ×</button></div>
    <div className="ot-rules-layout">
      <nav aria-label={text.nav}>
        <button type="button" className={current === 'top' ? 'active' : ''} aria-current={current === 'top' ? 'location' : undefined} onClick={() => go('top')}>{text.quick}</button>
        {rules.sections.map(item => <button type="button" key={item.id} className={current === item.id ? 'active' : ''} aria-current={current === item.id ? 'location' : undefined} onClick={() => go(item.id)}>{item.title}</button>)}
      </nav>
      <article tabIndex={0} aria-label={`${rules.title} ${text.details}`}>
        <section id="rules-top" data-rules-section="top">
          <h2>{rules.title}</h2><p className="ot-rules-summary">{rules.summary}</p><h3>{text.quick}</h3>
          <ol>{rules.quick.map(line => <li key={line}>{line}</li>)}</ol>
        </section>
        {rules.sections.map(item => <section key={item.id} id={`rules-${item.id}`} data-rules-section={item.id}>
          <h3>{item.title}</h3>{item.paragraphs.map(text => <p key={text}>{text}</p>)}{item.example && <aside>{item.example}</aside>}
        </section>)}
        <button type="button" className="ot-rules-top" onClick={() => go('top')}>{text.back}</button>
      </article>
    </div>
  </dialog>;
}

export function RulesButton({ gameId, label = 'Rules', className, locale }: { gameId: RulesGame; label?: string; className?: string; locale?: RulesLocale }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>{open && <RulesSheet gameId={gameId} onClose={() => setOpen(false)} locale={locale} />}</>;
}
