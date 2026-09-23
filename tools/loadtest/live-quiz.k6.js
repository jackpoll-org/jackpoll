// Live quiz load test: one presenter drives a fixed schedule, PLAYERS
// participants behave like LiveParticipant (results WebSocket, lobby join every
// 4s, resync poll every 6s, one answer per question).
//
// Broadcast latency is measured against the presenter's schedule, which is
// only accurate when k6 and the backend share a clock (run locally).
//
// SURVEY=<id> k6 run tools/loadtest/live-quiz.k6.js

import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const API = __ENV.API || "http://localhost:8090";
const WS = API.replace(/^http/, "ws");
const KC = __ENV.KC || "http://localhost:8180";
const SURVEY = __ENV.SURVEY;
const PLAYERS = Number(__ENV.PLAYERS || 200);
const QUESTIONS = Number(__ENV.QUESTIONS || 10);
const JOIN_RAMP_S = Number(__ENV.JOIN_RAMP_S || 20);

const LOBBY_S = 5;
const COUNTDOWN_S = 2.6;
const ANSWER_S = 8;
const REVEAL_S = 4;

const broadcastLatency = new Trend("live_broadcast_latency", true);
const submitDuration = new Trend("answer_submit_duration", true);
const submitOk = new Rate("answer_submit_ok");
const liveMissed = new Counter("live_question_missed");
const resultsFrames = new Counter("ws_results_frames");

export const options = {
  setupTimeout: "60s",
  scenarios: {
    presenter: { executor: "per-vu-iterations", vus: 1, iterations: 1, exec: "presenter", maxDuration: "10m" },
    players: { executor: "per-vu-iterations", vus: PLAYERS, iterations: 1, exec: "player", maxDuration: "10m" },
  },
  thresholds: {
    live_broadcast_latency: ["p(95)<1000"],
    answer_submit_duration: ["p(95)<1000"],
    answer_submit_ok: ["rate>0.99"],
    live_question_missed: ["count==0"],
  },
};

function schedule() {
  const events = [{ at: 0, index: 0, phase: "lobby" }];
  let t = LOBBY_S;
  for (let i = 0; i < QUESTIONS; i++) {
    events.push({ at: t, index: i, phase: "countdown" });
    events.push({ at: t + COUNTDOWN_S, index: i, phase: "question" });
    events.push({ at: t + COUNTDOWN_S + ANSWER_S, index: i, phase: "reveal" });
    t += COUNTDOWN_S + ANSWER_S + REVEAL_S;
  }
  events.push({ at: t, index: QUESTIONS - 1, phase: "results" });
  return events;
}

export function setup() {
  if (!SURVEY) throw new Error("SURVEY env var is required");
  const res = http.post(`${KC}/realms/survey-school/protocol/openid-connect/token`, {
    grant_type: "password",
    client_id: "survey-backend",
    client_secret: __ENV.KC_SECRET || "secret",
    username: __ENV.KC_USER || "testuser@survey.local",
    password: __ENV.KC_PASS || "Test1234",
  });
  check(res, { "presenter token": (r) => r.status === 200 });
  const token = res.json("access_token");
  const survey = http.get(`${API}/api/v1/surveys/${SURVEY}`, { headers: { Authorization: `Bearer ${token}` } });
  if (survey.status !== 200) throw new Error(`survey ${SURVEY} not found (${survey.status})`);
  const questions = survey
    .json("data.questions")
    .sort((a, b) => a.order - b.order)
    .map((q) => ({ id: q.id, options: q.options.map((o) => o.id) }));
  return { token, questions, startAt: Date.now() + (JOIN_RAMP_S + 5) * 1000 };
}

function sleepUntil(ms) {
  const wait = ms - Date.now();
  if (wait > 0) sleep(wait / 1000);
}

export function presenter(data) {
  const headers = { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" };
  for (const ev of schedule()) {
    sleepUntil(data.startAt + ev.at * 1000);
    const res = http.post(
      `${API}/api/v1/surveys/${SURVEY}/live/state`,
      JSON.stringify({ index: ev.index, phase: ev.phase }),
      { headers, tags: { name: "presenter_set_state" } },
    );
    check(res, { "presenter state 200": (r) => r.status === 200 });
  }
}

export function player(data) {
  const events = schedule();
  const sentAt = {};
  for (const ev of events) sentAt[`${ev.index}:${ev.phase}`] = data.startAt + ev.at * 1000;
  const endAt = data.startAt + (events[events.length - 1].at + 10) * 1000;
  const name = `player-${__VU}`;
  const json = { headers: { "Content-Type": "application/json" } };

  // Players trickle in during the join ramp, like a class scanning the QR code.
  sleep(Math.random() * JOIN_RAMP_S);

  const seen = {};
  let phase = "lobby";
  let questionAt = 0;

  const res = ws.connect(`${WS}/results-ws/${SURVEY}`, null, (socket) => {
    const join = () =>
      http.post(`${API}/api/v1/surveys/${SURVEY}/live/join`, JSON.stringify({ name }), {
        ...json,
        tags: { name: "live_join" },
      });

    socket.on("open", () => {
      join();
      socket.setInterval(() => {
        if (phase === "lobby") join();
      }, 4000);
      socket.setInterval(() => {
        http.get(`${API}/api/v1/surveys/${SURVEY}/live/state`, { tags: { name: "live_state_poll" } });
      }, 6000);
      socket.setTimeout(() => socket.close(), Math.max(0, endAt - Date.now()));
    });

    socket.on("message", (msg) => {
      let parsed;
      try {
        parsed = JSON.parse(msg);
      } catch (_) {
        return;
      }
      if (!parsed.live) {
        resultsFrames.add(1);
        return;
      }
      const { index, phase: next } = parsed.live;
      const key = `${index}:${next}`;
      if (seen[key]) return;
      seen[key] = true;
      phase = next;
      if (sentAt[key]) broadcastLatency.add(Date.now() - sentAt[key], { phase: next });

      if (next === "question") {
        questionAt = Date.now();
        socket.setTimeout(() => answer(index), 500 + Math.random() * 5500);
      } else if (next === "results") {
        socket.close();
      }
    });

    function answer(index) {
      if (phase !== "question") return;
      const q = data.questions[index];
      const body = {
        answers: [{ questionId: q.id, value: q.options[Math.floor(Math.random() * q.options.length)] }],
        respondentName: name,
        durationMs: Date.now() - questionAt,
      };
      const r = http.post(`${API}/api/v1/surveys/${SURVEY}/responses`, JSON.stringify(body), {
        ...json,
        tags: { name: "answer_submit" },
      });
      submitDuration.add(r.timings.duration);
      submitOk.add(r.status === 201);
    }
  });

  check(res, { "ws upgraded": (r) => r && r.status === 101 });
  for (let i = 0; i < QUESTIONS; i++) {
    if (!seen[`${i}:question`]) liveMissed.add(1);
  }
}
