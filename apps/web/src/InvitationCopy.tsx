import { useEffect, useRef, useState } from 'react';

type CopyInviteButtonProps = { url: string; label?: string; className?: string };

export function CopyInviteButton({ url, label = 'Copy link', className }: CopyInviteButtonProps) {
  const [state, setState] = useState<'ready' | 'copied' | 'manual'>('ready');
  const fallback = useRef<HTMLInputElement>(null);

  useEffect(() => { setState('ready'); }, [url]);
  useEffect(() => {
    if (state !== 'manual') return;
    fallback.current?.focus();
    fallback.current?.select();
  }, [state]);

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('manual');
    }
  }

  return <span className="copy-invite">
    <button type="button" className={className} onClick={() => void copy()}>{state === 'copied' ? 'Copied' : label}</button>
    {state === 'copied' && <span className="copy-invite-status" role="status" aria-live="polite">Invitation link copied.</span>}
    {state === 'manual' && <>
      <span className="copy-invite-status" role="status" aria-live="polite">Copy unavailable. The link is selected; copy it manually.</span>
      <input ref={fallback} className="copy-invite-fallback" aria-label="Invitation link, selected for copying" readOnly value={url} onFocus={event => event.currentTarget.select()} />
    </>}
  </span>;
}
