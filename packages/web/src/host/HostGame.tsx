// The Host's control view of a live Game, rendered only from the Host snapshot (ADR 0002).
// When a Question's countdown reaches zero, this screen asks the server to close it (ADR 0003).
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, messageFor } from '../api.js';
import {
  ConfirmDialog,
  Countdown,
  ErrorNote,
  Leaderboard,
  Options,
  Page,
  QuestionHeader,
} from '../components.js';
import { useCountdown } from '../sync/use-countdown.js';
import { useLiveSnapshot } from '../sync/use-live-snapshot.js';
import { runningDeadline, type HostSnapshot } from '../types.js';
import { hostToken } from './auth.js';
import { joinLink } from './join-link.js';
import { QrCode } from './QrCode.js';

export function HostGame() {
  const { gameId = '' } = useParams();
  const live = useLiveSnapshot({
    key: gameId,
    fetchSnapshot: async () => {
      const s = await api<HostSnapshot>('GET', `/api/games/${gameId}`, {
        token: await hostToken(),
      });
      return { ...s, deadline: runningDeadline(s) };
    },
    channels: [`/game/${gameId}/host`, `/game/${gameId}/players`],
    token: hostToken,
  });
  const s = live.snapshot;
  const remaining = useCountdown(s ? runningDeadline(s) : null, live.clock);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function command(path: string, method = 'POST') {
    setBusy(true);
    setError(null);
    try {
      await api(method, `/api/games/${gameId}${path}`, { token: await hostToken() });
    } catch (err) {
      // Closing a moment early (clock skew) is harmless: the deadline retry below handles it.
      if (!(err instanceof ApiError && err.code === 'DEADLINE_NOT_REACHED'))
        setError(messageFor(err));
    } finally {
      setBusy(false);
      live.refresh();
    }
  }

  // FR-8.5: the Host ends the Game early. Players see the final Leaderboard at once.
  async function cancelGame() {
    setCancelling(true);
    setCancelError(null);
    try {
      await api('POST', `/api/games/${gameId}/cancel`, { token: await hostToken() });
      setConfirmingCancel(false);
    } catch (err) {
      setCancelError(messageFor(err));
    } finally {
      setCancelling(false);
      live.refresh();
    }
  }

  // ADR 0003: the Host's client closes the Question at the deadline. Retry every second until
  // the snapshot leaves QUESTION_OPEN, in case our clock runs slightly ahead of the server's.
  const deadlineReached = s?.phase === 'QUESTION_OPEN' && remaining === 0;
  const refresh = useRef(live.refresh);
  refresh.current = live.refresh;
  useEffect(() => {
    if (!deadlineReached) return;
    let cancelled = false;
    const send = async () => {
      try {
        await api('POST', `/api/games/${gameId}/close`, { token: await hostToken() });
      } catch {
        // DEADLINE_NOT_REACHED (clock skew) or already closed: the retry or snapshot settles it.
      }
      if (!cancelled) refresh.current();
    };
    void send();
    const timer = setInterval(() => void send(), 1_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [deadlineReached, gameId]);

  if (!s) {
    return (
      <Page>{live.error ? <ErrorNote message={messageFor(live.error)} /> : <p>Loading…</p>}</Page>
    );
  }

  const cancelButton = (
    <button
      type="button"
      className="button button--danger"
      disabled={busy || cancelling}
      onClick={() => {
        setCancelError(null);
        setConfirmingCancel(true);
      }}
    >
      Cancel game
    </button>
  );

  const cancelDialog = (
    <ConfirmDialog
      open={confirmingCancel && s.phase !== 'FINISHED'}
      title="Cancel this game?"
      confirmLabel="Cancel game"
      busyLabel="Cancelling…"
      busy={cancelling}
      error={cancelError}
      onConfirm={() => void cancelGame()}
      onCancel={() => setConfirmingCancel(false)}
    >
      <p>
        {s.phase === 'LOBBY'
          ? 'Players who have joined will be told the game is over.'
          : 'Players will see the final leaderboard now. The current question won’t be scored. The game is kept in Past games.'}
      </p>
    </ConfirmDialog>
  );

  switch (s.phase) {
    case 'LOBBY': {
      const link = joinLink(window.location.origin, s.joinCode);
      return (
        <Page title="Waiting for players" wide>
          <div className="lobby">
            <div className="joincode">
              <p className="muted">Join at {window.location.host}/play with code</p>
              <p className="joincode__code">{s.joinCode}</p>
              <QrCode value={link} label={`QR code to join with code ${s.joinCode}`} />
              <p className="joincode__scan">Scan to join</p>
              <p className="joincode__link">
                <a href={link}>{link}</a>
              </p>
            </div>
            <div className="lobby__players">
              <h2>
                {s.players.length} {s.players.length === 1 ? 'player' : 'players'}
              </h2>
              <ul className="players">
                {s.players.map((p) => (
                  <li key={p.playerId}>
                    {p.nickname}
                    <button
                      type="button"
                      className="link link--danger"
                      onClick={() => void command(`/players/${p.playerId}`, 'DELETE')}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <ErrorNote message={error} />
              <button
                type="button"
                className="button button--primary"
                disabled={busy || s.players.length === 0}
                onClick={() => void command('/start')}
              >
                Start the game
              </button>
              {cancelButton}
            </div>
          </div>
          {cancelDialog}
        </Page>
      );
    }

    case 'QUESTION_OPEN': {
      const q = s.question!;
      return (
        <Page>
          <Countdown ms={remaining} />
          <QuestionHeader index={q.questionIndex} count={q.questionCount} text={q.text} />
          <Options options={q.options} />
          <p className="answered">
            {s.answered?.answered ?? 0} of {s.answered?.total ?? 0} answered
          </p>
          <ErrorNote message={error} />
          {cancelButton}
          {cancelDialog}
        </Page>
      );
    }

    case 'REVEAL': {
      const q = s.question!;
      const r = s.reveal!;
      const last = q.questionIndex + 1 >= q.questionCount;
      return (
        <Page>
          <QuestionHeader index={q.questionIndex} count={q.questionCount} text={q.text} />
          <Options options={q.options} correct={r.correctOptionId} counts={r.optionCounts} />
          <h2>Leaderboard</h2>
          <Leaderboard entries={r.results} />
          <ErrorNote message={error} />
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={() => void command('/next')}
          >
            {last ? 'Finish the game' : 'Next question'}
          </button>
          {cancelButton}
          {cancelDialog}
        </Page>
      );
    }

    case 'FINISHED':
      return (
        <Page title="Final leaderboard">
          <Leaderboard entries={s.leaderboard ?? []} />
          <Link className="button button--primary" to="/host">
            Back to your quizzes
          </Link>
          <Link className="button" to={`/host/history/${s.gameId}`}>
            See this game’s full results
          </Link>
        </Page>
      );
  }
}
