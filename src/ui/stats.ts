import { fetchServerStats, javaHashCode, type ServerStats, type ServerStatsSession } from '@magiden/client-core';
import { h, replaceChildren } from '../dom/h';
import { CLIENT_TYPE } from '../instance';
import type { Ctx } from '../render/common';

const KNOWN_HEADER_KEYS = new Set([
  'session-count', 'session-max', 'session-ttl', 'session-short-ttl',
  'session-next-evict', 'session-next-evict-explanation',
]);

const KNOWN_SESSION_KEYS = new Set([
  'is-admin', 'uid-hash', 'file-path', 'is-short-lived',
  'command-count', 'file-request-count', 'last-active-time', 'last-active-time-explanation',
]);

const POLL_OPTIONS = [2, 5, 10, 30] as const;

function fmtMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const hours = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${hours}h ${rm}m` : `${hours}h`;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return `in ${fmtMs(-diff)}`;
  if (diff < 3_000) return 'just now';
  return `${fmtMs(diff)} ago`;
}

function capColorClass(ratio: number): string {
  if (ratio < 0.6) return 'mg-stats-ok';
  if (ratio < 0.8) return 'mg-stats-warn';
  if (ratio < 0.9) return 'mg-stats-high';
  return 'mg-stats-crit';
}

function hexHash(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function fileName(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

function extraEntries(obj: Record<string, unknown>, known: Set<string>): [string, unknown][] {
  return Object.entries(obj).filter(([k]) => !known.has(k));
}

function renderVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// The admin/debug view over `server-stats`: capacity, TTLs, eviction, the session table (with "End session" on yours).
export function renderStatsDashboard(ctx: Ctx, onClose: () => void): HTMLElement {
  const { magid, scope } = ctx;
  let stats: ServerStats | null = null;
  let error: string | null = null;
  let updatedAt: Date | null = null;
  let fetching = false;
  let pollSecs: number = 5;
  let stopPolling = () => {};

  const pulse = h('span', { class: 'mg-stats-pulse', title: 'Refreshing…' });
  const refresh = h('button', { class: 'mg-stats-refreshBtn', title: 'Refresh now', on: { click: () => void doFetch() } }, '↻');
  const pollGroup = h('div', { class: 'mg-stats-pollGroup' });
  const content = h('div', { class: 'mg-stats-content' });

  const doFetch = async () => {
    const { baseUrl, sessionId } = magid.store.get();
    fetching = true;
    showTopbar();
    try {
      stats = await fetchServerStats({ baseUrl, sessionId: sessionId ?? undefined, clientType: CLIENT_TYPE });
      error = null;
      updatedAt = new Date();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Request failed';
    } finally {
      fetching = false;
    }
    if (!scope.alive) return;
    showTopbar();
    showContent();
  };

  const poll = (secs: number) => {
    pollSecs = secs;
    stopPolling();
    stopPolling = scope.interval(() => void doFetch(), secs * 1_000);
    showTopbar();
  };

  const showTopbar = () => {
    pulse.hidden = !fetching;
    refresh.disabled = fetching;
    replaceChildren(pollGroup, ...POLL_OPTIONS.map((s) => h('button', {
      class: ['mg-stats-pollBtn', pollSecs === s && 'mg-stats-pollBtnActive'],
      on: { click: () => poll(s) },
    }, `${s}s`)));
  };

  const showContent = () => {
    const { sessionId } = magid.store.get();
    const myHash = sessionId !== null ? javaHashCode(sessionId) : null;
    const header = stats?.header;
    const capacity = header ? header['session-count'] / header['session-max'] : 0;
    const extraSessionKeys = stats
      ? Array.from(stats.sessions.reduce((acc, s) => {
        for (const k of Object.keys(s)) if (!KNOWN_SESSION_KEYS.has(k)) acc.add(k);
        return acc;
      }, new Set<string>()))
      : [];
    const extraHeader = header ? extraEntries(header as unknown as Record<string, unknown>, KNOWN_HEADER_KEYS) : [];
    const card = (label: string, value: Node | string, sub: string, valueClass?: string, subTitle?: string, extra?: Node) =>
      h('div', { class: 'mg-stats-card' },
        h('div', { class: 'mg-stats-cardLabel' }, label),
        h('div', { class: ['mg-stats-cardValue', valueClass] }, value),
        extra,
        h('div', { class: 'mg-stats-cardSub', title: subTitle }, sub),
      );

    replaceChildren(content,
      error ? h('div', { class: 'mg-stats-errorBanner' }, error) : null,
      header ? h('div', { class: 'mg-stats-cards' },
        card('Sessions', h('span', null, `${header['session-count']} `, h('span', { class: 'mg-stats-cardOf' }, `/ ${header['session-max']}`)),
          `${(capacity * 100).toFixed(0)}% capacity`, capColorClass(capacity), undefined,
          h('div', { class: 'mg-stats-capBar' },
            h('div', { class: ['mg-stats-capFill', capColorClass(capacity)], style: { width: `${Math.min(capacity * 100, 100).toFixed(1)}%` } }))),
        card('Session TTL', fmtMs(header['session-ttl']), 'idle timeout'),
        card('Short-lived TTL', fmtMs(header['session-short-ttl']), 'for unauthenticated'),
        card('Next Eviction', relTime(header['session-next-evict']), new Date(header['session-next-evict']).toLocaleTimeString(),
          undefined, header['session-next-evict-explanation']),
      ) : null,
      extraHeader.length > 0 ? h('div', { class: 'mg-stats-section' },
        h('div', { class: 'mg-stats-sectionTitle' }, 'Additional server info'),
        h('div', { class: 'mg-stats-kvGrid' }, ...extraHeader.map(([k, v]) => h('div', { class: 'mg-stats-kvRow' },
          h('span', { class: 'mg-stats-kvKey' }, k), h('span', { class: 'mg-stats-kvVal' }, renderVal(v))))),
      ) : null,
      stats ? h('div', { class: 'mg-stats-section' },
        h('div', { class: 'mg-stats-sectionTitle' }, 'Sessions', h('span', { class: 'mg-stats-sectionCount' }, String(stats.sessions.length))),
        stats.sessions.length === 0
          ? h('div', { class: 'mg-stats-empty' }, 'No active sessions')
          : h('div', { class: 'mg-stats-tableWrap' }, h('table', { class: 'mg-stats-table' },
            h('thead', null, h('tr', null,
              ...['UID', 'Story file', 'Role', 'Type', 'Commands', 'File reqs', 'Last active', ...extraSessionKeys, ''].map((t) => h('th', null, t)))),
            h('tbody', null, ...stats.sessions.map((s) => renderSessionRow(s, extraSessionKeys, myHash !== null && s['uid-hash'] === myHash,
              async () => { await magid.client.endSession(); onClose(); }))),
          )),
      ) : null,
      updatedAt ? h('div', { class: 'mg-stats-footer' }, `Last updated: ${updatedAt.toLocaleTimeString()}`) : null,
    );
  };

  // Close on Escape (the window in the full app, the Magid area when embedded).
  scope.listen(magid.host.keyTarget, 'keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') onClose(); });
  showTopbar();
  poll(pollSecs);
  void doFetch();

  return h('div', { class: 'mg-stats-overlay' },
    h('div', { class: 'mg-stats-topbar' },
      h('span', { class: 'mg-stats-titleIcon' }, '◈'),
      h('h1', { class: 'mg-stats-title' }, 'Server Stats'),
      pulse,
      pollGroup,
      refresh,
      h('button', { class: 'mg-stats-closeBtn', title: 'Close', on: { click: onClose } }, '✕'),
    ),
    content,
  );
}

function renderSessionRow(s: ServerStatsSession, extraKeys: string[], isMine: boolean, onEndSession: () => Promise<void>): HTMLElement {
  const action = h('td', { class: 'mg-stats-actionCell' });
  const showAction = (confirming: boolean, ending = false) => {
    if (!isMine) return;
    replaceChildren(action, confirming
      ? h('span', { class: 'mg-stats-confirmInline' },
        'End session?',
        h('button', {
          class: 'mg-stats-confirmYes', disabled: ending,
          on: { click: async () => { showAction(true, true); await onEndSession(); showAction(false); } },
        }, ending ? '…' : 'Yes'),
        h('button', { class: 'mg-stats-confirmNo', disabled: ending, on: { click: () => showAction(false) } }, 'No'))
      : h('button', { class: 'mg-stats-endSessionBtn', on: { click: () => showAction(true) } }, 'End session'));
  };
  showAction(false);

  return h('tr', { class: isMine ? 'mg-stats-myRow' : undefined },
    h('td', null,
      h('span', { class: 'mg-stats-hashChip', title: String(s['uid-hash']) }, hexHash(s['uid-hash'])),
      isMine ? h('span', { class: 'mg-stats-meBadge' }, 'you') : null),
    h('td', null, h('span', { class: 'mg-stats-filepath', title: s['file-path'] }, fileName(s['file-path']))),
    h('td', null, s['is-admin']
      ? h('span', { class: 'mg-stats-badge mg-stats-badgeAdmin' }, 'Admin')
      : h('span', { class: 'mg-stats-badge mg-stats-badgeUser' }, 'User')),
    h('td', null, s['is-short-lived']
      ? h('span', { class: 'mg-stats-badge mg-stats-badgeShort' }, 'Short')
      : h('span', { class: 'mg-stats-muted' }, 'Standard')),
    h('td', { class: 'mg-stats-num' }, String(s['command-count'])),
    h('td', { class: 'mg-stats-num' }, String(s['file-request-count'])),
    h('td', null, h('span', { title: new Date(s['last-active-time']).toLocaleString() }, relTime(s['last-active-time']))),
    ...extraKeys.map((k) => h('td', null, renderVal(s[k]))),
    action,
  );
}
