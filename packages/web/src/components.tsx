// Small shared pieces of the Host and Player screens.
import { useEffect, useRef, type ReactNode } from 'react';
import type { LeaderboardEntry, Option } from './types.js';

export function Page({
  title,
  wide = false,
  children,
}: {
  title?: string;
  /** Use the full width of large screens, e.g. the Lobby shown on a projector. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={wide ? 'page page--wide' : 'page'}>
      {title && <h1>{title}</h1>}
      {children}
    </main>
  );
}

export function Countdown({ ms }: { ms: number | null }) {
  if (ms === null) return null;
  const seconds = Math.ceil(ms / 1000);
  return (
    <div className={`countdown${seconds <= 5 ? ' countdown--urgent' : ''}`} aria-live="polite">
      {seconds}
    </div>
  );
}

export function QuestionHeader({
  index,
  count,
  text,
}: {
  index: number;
  count: number;
  text: string;
}) {
  return (
    <header className="question">
      <p className="question__count">
        Question {index + 1} of {count}
      </p>
      <h2 className="question__text">{text}</h2>
    </header>
  );
}

/** Option tiles. `onPick` makes them buttons; otherwise they just show state. */
export function Options(props: {
  options: Option[];
  chosen?: string | null;
  correct?: string | null;
  counts?: Record<string, number> | null;
  onPick?: (optionId: string) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="options">
      {props.options.map((o, i) => {
        const classes = [
          'option',
          `option--${i}`,
          props.chosen === o.optionId ? 'option--chosen' : '',
          props.correct === o.optionId ? 'option--correct' : '',
          props.correct && props.correct !== o.optionId ? 'option--wrong' : '',
        ].join(' ');
        const label = (
          <>
            <span className="option__text">{o.text}</span>
            {props.counts && <span className="option__count">{props.counts[o.optionId] ?? 0}</span>}
          </>
        );
        return (
          <li key={o.optionId}>
            {props.onPick ? (
              <button
                type="button"
                className={classes}
                disabled={props.disabled}
                onClick={() => props.onPick?.(o.optionId)}
              >
                {label}
              </button>
            ) : (
              <div className={classes}>{label}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Leaderboard({
  entries,
  highlight,
}: {
  entries: LeaderboardEntry[];
  highlight?: string;
}) {
  if (entries.length === 0) return <p className="muted">No players.</p>;
  return (
    <ol className="leaderboard">
      {entries.map((e) => (
        <li key={e.playerId} className={e.playerId === highlight ? 'leaderboard__me' : undefined}>
          <span className="leaderboard__rank">{e.rank}</span>
          <span className="leaderboard__name">{e.nickname}</span>
          <span className="leaderboard__score">{e.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}

/**
 * A modal confirmation for a destructive action, on the native <dialog> element (focus trap,
 * Esc and the backdrop come with it). Cancel has the focus, so Enter doesn't destroy anything.
 * Stays open while `busy`, and shows `error` if the action fails.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function cancel() {
    if (!busy) onCancel();
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc: close through state, so React stays in charge.
        cancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel(); // A click on the backdrop.
      }}
    >
      <h2 id="dialog-title" className="dialog__title">
        {title}
      </h2>
      <div className="dialog__body">{children}</div>
      <ErrorNote message={error} />
      <div className="dialog__actions">
        <button type="button" className="button" autoFocus disabled={busy} onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button button--destructive"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
