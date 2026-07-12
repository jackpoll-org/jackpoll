// ── Live co-editing provider (issue #85) ────────────────────────────
//
// Connects to the backend WebSocket relay and runs both:
//  - the Yjs document sync protocol (y-protocols/sync) for real-time content
//    merge of the shared survey doc, and
//  - ephemeral awareness (who's editing + name/colour) for presence.
// The relay is a dumb binary fan-out; peers sync among themselves. No-op unless
// collab is enabled.

import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { readSyncMessage, writeSyncStep1, writeUpdate } from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { getFieldText } from "./doc";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// Re-announce local presence on this cadence. The backend relay is stateless
// (no awareness replay for late joiners), and y-protocols expires a peer's
// state after ~30s without an update — so without a heartbeat a collaborator
// silently drops out of everyone's presence. 15s stays comfortably under that.
const PRESENCE_HEARTBEAT_MS = 15_000;

/** Identifies a collaboratively-edited text field for caret tracking (#85). */
export interface TextTarget {
  questionId?: string;
  sectionId?: string;
  field: "title" | "description";
}

/** A remote peer's caret/selection resolved to absolute character offsets. */
export interface RemoteCaret {
  clientId: number;
  name: string;
  color: string;
  anchor: number;
  head: number;
}

function targetKey(t: TextTarget): string {
  const scope = t.questionId
    ? `q:${t.questionId}`
    : t.sectionId
      ? `s:${t.sectionId}`
      : "root";
  return `${scope}:${t.field}`;
}

/** Which field a collaborator currently has focused (issue #85). */
export interface FocusState {
  questionId?: string;
  sectionId?: string;
  /** e.g. "title" | "description" | "option:<id>". */
  field: string;
}

/** Where a peer currently is in the builder — drives "follow" (issue #85). */
export interface BuilderLocation {
  /** Active builder page (section id, or null for Page 1). */
  pageId: string | null;
  /** The question the peer is currently working in, if any. */
  questionId?: string | null;
}

export interface PresenceUser {
  clientId: number;
  name: string;
  color: string;
  /** The field this peer is editing right now, if any. */
  focus?: FocusState;
  /** The peer's current builder page + question, for follow mode. */
  location?: BuilderLocation;
}

/**
 * Whether live collaboration is enabled for this instance. Read at runtime from
 * a flag the server injects (`window.__COLLAB_ENABLED__`, from the COLLAB_ENABLED
 * env var) so self-hosters can toggle it without rebuilding the image; falls
 * back to the build-time NEXT_PUBLIC_COLLAB_ENABLED.
 */
export function collabEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __COLLAB_ENABLED__?: boolean };
  if (typeof w.__COLLAB_ENABLED__ === "boolean") return w.__COLLAB_ENABLED__;
  return process.env.NEXT_PUBLIC_COLLAB_ENABLED === "true";
}

function collabUrl(surveyId: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // `/collab-ws` (not `/collab`) so the WebSocket prefix doesn't shadow the
  // frontend `/collab/[slug]` page — Traefik routes `/collab-ws` to the backend.
  return `${proto}://${window.location.host}/collab-ws/${surveyId}`;
}

export class CollabProvider {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly surveyId: string,
    user: { name: string; color: string },
  ) {
    this.awareness.setLocalStateField("user", user);
    this.awareness.on("update", this.onAwarenessChange);
    this.doc.on("update", this.onDocUpdate);
    // Mobile WebViews suspend in the background and kill the socket while our
    // reconnect timer is frozen — so on resume nothing reconnects and presence
    // stays empty. Reconnect eagerly whenever the page becomes visible/focused.
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisible);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", this.onVisible);
      window.addEventListener("online", this.onVisible);
    }
    this.connect();
  }

  private onVisible = () => {
    if (this.closed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    const rs = this.ws?.readyState;
    if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connect();
  };

  private connect = () => {
    if (this.closed) return;
    const url = collabUrl(this.surveyId);
    // Lightweight diagnostics: Capacitor pipes console.* to logcat/Xcode, so
    // these surface why collab fails in the native app (e.g. wrong host, blocked
    // upgrade). Filter with `adb logcat | grep "\[collab\]"`.
    console.info(`[collab] connecting ${url}`);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      console.info("[collab] open");
      // Ask peers for the current document state…
      this.requestSync();
      // …and announce our presence, then keep re-announcing so late joiners and
      // any peer that missed the first announce still see us (stateless relay).
      this.announcePresence();
      this.startHeartbeat();
    };
    ws.onmessage = (e) => this.onMessage(new Uint8Array(e.data as ArrayBuffer));
    ws.onclose = (e) => {
      console.info(`[collab] close code=${e?.code} clean=${e?.wasClean}`);
      this.stopHeartbeat();
      if (this.closed) return;
      this.reconnectTimer = setTimeout(this.connect, 2000);
    };
    ws.onerror = () => {
      console.warn("[collab] error (will reconnect)");
      ws.close();
    };
  };

  /** Re-publish our own awareness state (bumps the clock so peers refresh us). */
  private announcePresence() {
    this.awareness.setLocalState(this.awareness.getLocalState());
  }

  /**
   * (Re)start the Yjs sync handshake: send our state vector so peers reply with
   * whatever we're missing. The relay keeps no document state to replay, so a
   * peer that missed the initial handshake would otherwise buffer every later
   * incremental update as pending-on-missing-base and show nothing — re-syncing
   * when a new peer appears guarantees both sides converge to the newest doc.
   */
  private requestSync() {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    writeSyncStep1(enc, this.doc);
    this.send(enc);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(
      () => this.announcePresence(),
      PRESENCE_HEARTBEAT_MS,
    );
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private onMessage(data: Uint8Array) {
    const decoder = decoding.createDecoder(data);
    const type = decoding.readVarUint(decoder);
    if (type === MSG_SYNC) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      // Applies the message to our doc (origin = this, so onDocUpdate won't echo)
      // and writes any reply (e.g. sync step 2) into enc.
      readSyncMessage(decoder, enc, this.doc, this);
      if (encoding.length(enc) > 1) this.send(enc);
    } else if (type === MSG_AWARENESS) {
      applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
    }
  }

  // Broadcast local document changes (skip updates we applied from the network).
  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    writeUpdate(enc, update);
    this.send(enc);
  };

  private send(enc: encoding.Encoder) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encoding.toUint8Array(enc));
    }
  }

  private onAwarenessChange = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === this) {
      // A network-applied change. When a brand-new peer appears, re-announce
      // ourselves so they learn about us — the relay keeps no awareness state to
      // replay, so without this a late joiner would never see existing editors.
      // Also re-run the doc sync handshake so the newcomer (or anyone who missed
      // the initial exchange) converges to the latest document, not just an
      // unappliable stream of incremental updates.
      if (added.length > 0) {
        this.announcePresence();
        this.requestSync();
      }
      return;
    }
    // A locally-originated change → broadcast it to peers.
    this.sendAwareness([...added, ...updated, ...removed]);
  };

  private sendAwareness(clients: number[]) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_AWARENESS);
    encoding.writeVarUint8Array(enc, encodeAwarenessUpdate(this.awareness, clients));
    this.send(enc);
  }

  /** Publish (or clear) which field this client is editing. */
  setFocus(focus: FocusState | null): void {
    this.awareness.setLocalStateField("focus", focus);
  }

  /** Publish this client's current builder page + question (for follow). */
  setLocation(location: BuilderLocation | null): void {
    this.awareness.setLocalStateField("location", location);
  }

  /** Publish this client's caret/selection in a text field as relative
   *  positions, so it stays correct as peers insert/delete text (#85). */
  setCaret(target: TextTarget, anchorIdx: number, headIdx: number): void {
    const ytext = getFieldText(this.doc, target);
    if (!ytext) return;
    const clamp = (i: number) => Math.max(0, Math.min(i, ytext.length));
    const toRel = (i: number) =>
      Y.relativePositionToJSON(
        Y.createRelativePositionFromTypeIndex(ytext, clamp(i)),
      );
    this.awareness.setLocalStateField("caret", {
      fieldKey: targetKey(target),
      anchor: toRel(anchorIdx),
      head: toRel(headIdx),
    });
  }

  /** Clear this client's caret (e.g. on blur). */
  clearCaret(): void {
    this.awareness.setLocalStateField("caret", null);
  }

  /** Remote peers' carets resolved to absolute offsets within a text field. */
  caretsFor(target: TextTarget): RemoteCaret[] {
    const key = targetKey(target);
    const out: RemoteCaret[] = [];
    const resolve = (json: unknown): number | null => {
      if (!json) return null;
      const rel = Y.createRelativePositionFromJSON(json);
      const abs = Y.createAbsolutePositionFromRelativePosition(rel, this.doc);
      return abs ? abs.index : null;
    };
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return;
      const s = state as {
        user?: { name?: string; color?: string };
        caret?: { fieldKey: string; anchor: unknown; head: unknown } | null;
      };
      if (!s.user?.name || !s.caret || s.caret.fieldKey !== key) return;
      const head = resolve(s.caret.head);
      if (head == null) return;
      const anchor = resolve(s.caret.anchor) ?? head;
      out.push({
        clientId,
        name: s.user.name,
        color: s.user.color ?? "#888",
        anchor,
        head,
      });
    });
    return out;
  }

  /** Current peers (excluding self). */
  presence(): PresenceUser[] {
    const out: PresenceUser[] = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return;
      const s = state as {
        user?: { name?: string; color?: string };
        focus?: FocusState | null;
        location?: BuilderLocation | null;
      };
      if (s.user?.name) {
        out.push({
          clientId,
          name: s.user.name,
          color: s.user.color ?? "#888",
          focus: s.focus ?? undefined,
          location: s.location ?? undefined,
        });
      }
    });
    return out;
  }

  /** Peers grouped by the question they're focused on (for per-card highlight). */
  focusByQuestion(): Map<string, PresenceUser[]> {
    return groupFocusByQuestion(this.presence());
  }

  onPresenceChange(cb: () => void): () => void {
    this.awareness.on("change", cb);
    return () => this.awareness.off("change", cb);
  }

  destroy() {
    this.closed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisible);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onVisible);
      window.removeEventListener("online", this.onVisible);
    }
    removeAwarenessStates(this.awareness, [this.doc.clientID], "destroy");
    this.awareness.off("update", this.onAwarenessChange);
    this.doc.off("update", this.onDocUpdate);
    this.ws?.close();
    this.awareness.destroy();
    this.doc.destroy();
  }
}

/** Group peers by the question id they're focused on (skips peers with no focus). */
export function groupFocusByQuestion(
  peers: PresenceUser[],
): Map<string, PresenceUser[]> {
  const map = new Map<string, PresenceUser[]>();
  for (const p of peers) {
    const qid = p.focus?.questionId;
    if (!qid) continue;
    const list = map.get(qid);
    if (list) list.push(p);
    else map.set(qid, [p]);
  }
  return map;
}

/**
 * Resolve who/where to follow (issue #85). Returns the followed peer plus the
 * page and question they're at, or null when not following or the peer has left
 * (so the caller can auto-stop following). Page + question come from the peer's
 * published location (which updates for any edit, not just titles); the focus
 * questionId is a fallback for older peers.
 */
export function resolveFollowTarget(
  peers: PresenceUser[],
  followingClientId: number | null,
): { peer: PresenceUser; pageId: string | null; questionId: string | null } | null {
  if (followingClientId == null) return null;
  const peer = peers.find((p) => p.clientId === followingClientId);
  if (!peer) return null;
  return {
    peer,
    pageId: peer.location?.pageId ?? null,
    questionId: peer.location?.questionId ?? peer.focus?.questionId ?? null,
  };
}

/** Deterministic colour from a string (stable per user). */
export function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 50%)`;
}
