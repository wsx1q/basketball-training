import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  History,
  LayoutDashboard,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Target,
  Timer,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  backup,
  createSession,
  initialState,
  lastExercise,
  parseBackup,
  readState,
  validatePlans,
  volume,
  writeState,
  type State,
  type Session,
  type Plan,
} from "./data";
import "./style.css";
const fmt = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.ceil(n % 60)
    .toString()
    .padStart(2, "0")}`;
const date = (s: string) =>
  new Date(s).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [state, setState] = useState<State>(initialState),
    [loaded, setLoaded] = useState(false),
    [tab, setTab] = useState("训练"),
    [selected, setSelected] = useState("w1-mon"),
    [week, setWeek] = useState(1),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [now, setNow] = useState(Date.now()),
    [restPaused, setRestPaused] = useState<number | null>(null),
    [restore, setRestore] = useState<State | null>(null),
    [detail, setDetail] = useState<Session | null>(null),
    [chartId, setChartId] = useState("squat"),
    [saving, setSaving] = useState(false);
  const readyRef = useRef(false),
    saveQueue = useRef(Promise.resolve()),
    alarmRef = useRef<number | null>(null),
    audio = useRef<AudioContext | null>(null);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setError("离线缓存注册失败，请联网刷新重试。"),
  });
  useEffect(() => {
    readState()
      .then((s) => {
        setState(s);
        setSelected(s.plans[0].id);
        setWeek(s.plans[0].week);
        setLoaded(true);
        readyRef.current = true;
      })
      .catch(() =>
        setError("无法打开本地数据库，请关闭隐私浏览或检查存储权限。"),
      );
  }, []);
  useEffect(() => {
    if (!readyRef.current) return;
    setSaving(true);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => writeState(state))
      .then(() => {
        setSaving(false);
      })
      .catch(() => {
        setSaving(false);
        setError("保存失败！请立即导出备份，并检查设备剩余空间。");
      });
  }, [state]);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    addEventListener("online", on);
    addEventListener("offline", on);
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", on);
      clearInterval(id);
    };
  }, []);
  useEffect(() => {
    if (
      state.restEnd &&
      now >= state.restEnd &&
      alarmRef.current !== state.restEnd
    ) {
      alarmRef.current = state.restEnd;
      setMessage("休息结束，准备下一组。");
      try {
        const ctx = audio.current;
        if (ctx) {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.value = 0.15;
          osc.frequency.value = 660;
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch {
        /* Visual timer remains available. */
      }
      navigator.vibrate?.([100, 80, 100]);
    }
  }, [now, state.restEnd]);
  useEffect(() => {
    if (message) {
      const id = setTimeout(() => setMessage(""), 4500);
      return () => clearTimeout(id);
    }
  }, [message]);
  const active = state.sessions.find((s) => !s.finishedAt),
    plan = state.plans.find((p) => p.id === selected) ?? state.plans[0],
    finished = state.sessions.filter((s) => s.finishedAt),
    done =
      active?.exercises.reduce(
        (n, e) => n + e.logs.filter((l) => l.done).length,
        0,
      ) ?? 0,
    total = active?.exercises.reduce((n, e) => n + e.logs.length, 0) ?? 0,
    remaining = state.restEnd
      ? Math.max(0, Math.ceil((state.restEnd - now) / 1000))
      : (restPaused ?? state.restDuration);
  const completed = finished.reduce(
    (n, s) =>
      n +
      s.exercises.reduce((m, e) => m + e.logs.filter((l) => l.done).length, 0),
    0,
  );
  function startRest(seconds: number) {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {}
    setRestPaused(null);
    setState((s) => ({
      ...s,
      restDuration: seconds,
      restEnd: Date.now() + seconds * 1000,
    }));
  }
  function changeSet(
    ei: number,
    li: number,
    patch: Partial<{ weight: number | null; reps: number; done: boolean }>,
  ) {
    if (!active) return;
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) =>
        se.id !== active.id
          ? se
          : {
              ...se,
              exercises: se.exercises.map((e, i) =>
                i !== ei
                  ? e
                  : {
                      ...e,
                      logs: e.logs.map((l, j) =>
                        j !== li ? l : { ...l, ...patch },
                      ),
                    },
              ),
            },
      ),
    }));
  }
  function begin(p: Plan) {
    if (active) {
      setSelected(active.planId);
      setTab("训练");
      setMessage("已回到进行中的训练。");
      return;
    }
    setState((s) => ({
      ...s,
      sessions: [...s.sessions, createSession(p, s.sessions)],
    }));
    setSelected(p.id);
    setTab("训练");
    void navigator.storage?.persist?.();
  }
  function finish() {
    if (!active || !done) return;
    setState((s) => ({
      ...s,
      restEnd: null,
      sessions: s.sessions.map((x) =>
        x.id === active.id ? { ...x, finishedAt: new Date().toISOString() } : x,
      ),
    }));
    setRestPaused(null);
    setMessage(`训练已保存，完成 ${done} 组。`);
    setTab("历史");
  }
  async function importFile(file: File | undefined, mode: "plan" | "backup") {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw Error("文件过大，请选择 20 MB 以内的 JSON。");
      const value = JSON.parse(await file.text());
      if (mode === "backup") setRestore(parseBackup(value));
      else {
        const plans = validatePlans(Array.isArray(value) ? value : value.plans);
        setState((s) => ({ ...s, plans }));
        setSelected(plans[0].id);
        setWeek(plans[0].week);
        setMessage(`已导入 ${plans.length} 个模板，历史记录已保留。`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "文件无法读取。");
    }
  }
  const nav = [
    { name: "训练", label: "训练计划", icon: LayoutDashboard },
    { name: "历史", label: "训练历史", icon: History },
    { name: "进步", label: "力量进步", icon: Activity },
    { name: "设置", label: "数据与设置", icon: Settings2 },
  ];
  const shown = active?.exercises ?? plan.exercises;
  return (
    <div className={"app " + (active ? "active-session" : "")}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brandmark">◉</span> COURT
          <span className="branddot">.</span>
        </a>
        <p className="brand-sub">篮球专项训练日志</p>
        <div className="nav-label">YOUR TRAINING</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={tab === n.name ? "nav active" : "nav"}
              onClick={() => setTab(n.name)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {tab === n.name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy">
            <ShieldCheck size={21} />
            <div>
              只属于你的训练数据<small>本地保存 · 无需账户</small>
            </div>
          </div>
          <div className="profile">
            <span>球</span>
            <div>
              每一次训练，都算数。<small>STAY CONSISTENT.</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header>
          <div className="breadcrumb">
            我的训练空间 <ChevronRight size={14} />
            <b>{nav.find((n) => n.name === tab)?.label}</b>
          </div>
          <div className="header-right">
            <span className={"connection " + (!online ? "offline" : "")}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>
                {offlineReady ? "离线已就绪" : online ? "在线" : "离线"}
              </span>
            </span>
            <span className="avatar">C</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">BUILT ON EVERY REP</div>
              <h1>
                {tab === "训练"
                  ? "把训练，变成场上的优势。"
                  : tab === "历史"
                    ? "每一次努力，都有记录。"
                    : tab === "进步"
                      ? "看见你的力量积累。"
                      : "你的训练，由你保管。"}
              </h1>
              <p>
                {tab === "训练"
                  ? "专注这一组。让每一次起跳，都更有力量。"
                  : tab === "历史"
                    ? "回顾训练细节，保持自己的节奏。"
                    : tab === "进步"
                      ? "从真实完成的每一组，观察长期变化。"
                      : "记录留在设备里，备份让它跟你一起走。"}
              </p>
            </div>
            <span className="season">
              BASKETBALL
              <br />
              <b>TRAINING / 01</b>
            </span>
          </div>
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button aria-label="关闭错误" onClick={() => setError("")}>
                <X size={18} />
              </button>
            </div>
          )}
          {needRefresh && (
            <div className="alert">
              新版本已就绪，请先完成训练并备份，再更新。
              <button onClick={() => void updateServiceWorker(true)}>
                更新应用
              </button>
            </div>
          )}
          {!loaded ? (
            <div className="empty">正在读取本地训练记录…</div>
          ) : (
            <>
              <div className="stats">
                <Stat
                  label="已完成训练"
                  value={String(finished.length).padStart(2, "0")}
                  unit="次"
                  icon={<Target />}
                  text="每次坚持，都向前一步"
                />
                <Stat
                  label="累计完成"
                  value={String(completed).padStart(2, "0")}
                  unit="组"
                  icon={<Dumbbell />}
                  text="扎实完成每一组"
                />
                <Stat
                  label="训练总负荷"
                  value={(
                    finished.reduce((n, s) => n + volume(s), 0) / 1000
                  ).toFixed(1)}
                  unit="t"
                  icon={<Flame />}
                  text="按已完成组的重量 × 次数计算"
                />
              </div>
              {tab === "训练" && (
                <div className="training-layout">
                  <section>
                    <div className="plan-banner">
                      <div>
                        <span className="pill">两周专项周期</span>
                        <h2>更强的下肢，更稳的对抗。</h2>
                        <p>力量 · 弹跳 · 单腿稳定 · 核心控制</p>
                        <div className="banner-meta">
                          <span>
                            <Dumbbell size={15} /> {state.plans.length}{" "}
                            个训练模板
                          </span>
                          <span>
                            <ShieldCheck size={15} /> 自动保存进度
                          </span>
                        </div>
                      </div>
                      <div className="court-art">
                        <div className="court-line" />
                        <div className="court-circle" />
                        <span>
                          STAY
                          <br />
                          IN THE
                          <br />
                          <b>GAME.</b>
                        </span>
                      </div>
                    </div>
                    <div className="section-heading">
                      <h2>{active ? "进行中的训练" : "选择训练日"}</h2>
                      {!active && (
                        <div className="segmented">
                          {[...new Set(state.plans.map((p) => p.week))].map(
                            (w) => (
                              <button
                                key={w}
                                className={week === w ? "chosen" : ""}
                                onClick={() => {
                                  setWeek(w);
                                  const p = state.plans.find(
                                    (p) => p.week === w,
                                  );
                                  if (p) setSelected(p.id);
                                }}
                              >
                                第 {w} 周
                              </button>
                            ),
                          )}
                        </div>
                      )}
                      {active && (
                        <span className="live">
                          <span /> {saving ? "保存中…" : "进度已保存"}
                        </span>
                      )}
                    </div>
                    {!active && (
                      <div className="plan-tabs">
                        {state.plans
                          .filter((p) => p.week === week)
                          .map((p) => (
                            <button
                              key={p.id}
                              className={plan.id === p.id ? "selected" : ""}
                              onClick={() => setSelected(p.id)}
                            >
                              <span className="day-icon">
                                {p.day.replace("周", "")}
                              </span>
                              <span>
                                <small>
                                  第 {p.week} 周 · {p.day}
                                </small>
                                <strong>
                                  {p.name.split("｜")[1] ?? p.name}
                                </strong>
                              </span>
                              {p.id === plan.id ? (
                                <Check size={18} />
                              ) : (
                                <ChevronRight size={18} />
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="workout-title">
                      <div>
                        <h2>{active?.name ?? plan.name}</h2>
                        <p>
                          {shown.length} 个动作 ·{" "}
                          {shown.reduce((n, e) => n + e.sets, 0)} 组 · 杠铃含杆
                          / 哑铃记单只重量
                        </p>
                      </div>
                      {!active && (
                        <button className="primary" onClick={() => begin(plan)}>
                          <Play size={16} />
                          开始训练
                        </button>
                      )}
                    </div>
                    {active && (
                      <div className="session-progress">
                        <div>
                          <span>本次进度</span>
                          <b>
                            {done} / {total} 组
                          </b>
                        </div>
                        <div className="track">
                          <i style={{ width: `${(done / total) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="exercise-list">
                      {shown.map((e, ei) => {
                        const last = lastExercise(state.sessions, e.id);
                        const logs = active?.exercises[ei].logs;
                        return (
                          <article className="exercise-card" key={e.id}>
                            <div className="exercise-header">
                              <span className="exercise-index">
                                {String(ei + 1).padStart(2, "0")}
                              </span>
                              <div className="exercise-name">
                                <h3>
                                  {e.name}
                                  <span>{e.equipment}</span>
                                </h3>
                                <p>{e.english}</p>
                              </div>
                              <span className="rest-label">
                                <Clock3 size={13} />
                                {e.rest}s
                              </span>
                            </div>
                            <div className="exercise-info">
                              <span>
                                {e.sets} 组 × {e.reps}
                                {e.id === "pullup" && e.note.includes("6–8")
                                  ? "–8"
                                  : ""}{" "}
                                {e.unit}
                                {e.side ? ` / ${e.side}` : ""}
                              </span>
                              <span>
                                {e.weight !== null
                                  ? `${e.weight} kg`
                                  : "自主选重 / 自重"}
                              </span>
                              <span>{e.note}</span>
                            </div>
                            <div className="last">
                              <History size={12} />
                              {last
                                ? "上次：" +
                                  last.logs
                                    .filter((l) => l.done)
                                    .map(
                                      (l) =>
                                        `${l.weight ?? "自重"}${l.weight === null ? "" : "kg"} × ${l.reps}${e.unit}`,
                                    )
                                    .join(" / ")
                                : "首次记录，从今天开始积累"}
                            </div>
                            {logs && (
                              <div className="set-table">
                                <div className="set-labels">
                                  <span>组</span>
                                  <span>
                                    {e.equipment === "哑铃"
                                      ? "单只重量 kg"
                                      : "重量 kg"}
                                  </span>
                                  <span>
                                    {e.unit}
                                    {e.side ? ` / ${e.side}` : ""}
                                  </span>
                                  <span>完成</span>
                                </div>
                                {logs.map((l, li) => (
                                  <div
                                    className={
                                      "set-row " + (l.done ? "done" : "")
                                    }
                                    key={li}
                                  >
                                    <span className="set-number">{li + 1}</span>
                                    <input
                                      aria-label={`${e.name}第${li + 1}组重量`}
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      max="1000"
                                      step="0.5"
                                      placeholder="自重/未设"
                                      value={l.weight ?? ""}
                                      onChange={(ev) => {
                                        const n =
                                          ev.target.value === ""
                                            ? null
                                            : Number(ev.target.value);
                                        if (n === null || (n >= 0 && n <= 1000))
                                          changeSet(ei, li, { weight: n });
                                      }}
                                    />
                                    <input
                                      aria-label={`${e.name}第${li + 1}组${e.unit}`}
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      max="3600"
                                      value={l.reps}
                                      onChange={(ev) => {
                                        const n = Number(ev.target.value);
                                        if (n >= 1 && n <= 3600)
                                          changeSet(ei, li, { reps: n });
                                      }}
                                    />
                                    <button
                                      aria-label={`${l.done ? "取消完成" : "完成"}${e.name}第${li + 1}组`}
                                      aria-pressed={l.done}
                                      className="check-set"
                                      onClick={() => {
                                        changeSet(ei, li, { done: !l.done });
                                        if (!l.done) startRest(e.rest);
                                      }}
                                    >
                                      <Check size={19} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    {active && (
                      <div className="finish-bar">
                        <div>
                          <b>今天的努力，值得记录。</b>
                          <p>
                            {done === total
                              ? "所有组已完成，可以收工了。"
                              : "未完成的组会保留为未完成。"}
                          </p>
                        </div>
                        <button
                          className="primary"
                          disabled={!done}
                          onClick={finish}
                        >
                          <Check size={17} />
                          结束并保存
                        </button>
                      </div>
                    )}
                  </section>
                  <aside className="right-column">
                    <div className="timer-card">
                      <div className="card-label">
                        <Timer size={17} />
                        <h3>组间休息</h3>
                        <span className="tiny-dot" />
                      </div>
                      <div
                        className={
                          "timer-face " +
                          (state.restEnd && remaining === 0 ? "expired" : "")
                        }
                      >
                        <svg viewBox="0 0 180 180">
                          <circle cx="90" cy="90" r="80" />
                          <circle
                            cx="90"
                            cy="90"
                            r="80"
                            strokeDasharray="503"
                            strokeDashoffset={
                              503 *
                              (1 -
                                Math.min(
                                  1,
                                  remaining / (state.restDuration || 1),
                                ))
                            }
                          />
                        </svg>
                        <div>
                          <strong>{fmt(remaining)}</strong>
                          <small>
                            {state.restEnd
                              ? remaining
                                ? "恢复一下，再来一组"
                                : "休息结束"
                              : restPaused !== null
                                ? "计时已暂停"
                                : "准备好下一组"}
                          </small>
                        </div>
                      </div>
                      <div className="timer-presets">
                        {[60, 90, 120, 180].map((s) => (
                          <button
                            key={s}
                            className={state.restDuration === s ? "chosen" : ""}
                            onClick={() => {
                              setState((x) => ({
                                ...x,
                                restDuration: s,
                                restEnd: null,
                              }));
                              setRestPaused(null);
                            }}
                          >
                            {s}s
                          </button>
                        ))}
                      </div>
                      <div className="timer-actions">
                        <button
                          aria-label="重置倒计时"
                          className="secondary"
                          onClick={() => {
                            setState((s) => ({ ...s, restEnd: null }));
                            setRestPaused(null);
                          }}
                        >
                          <RotateCcw size={17} />
                        </button>
                        <button
                          className="primary"
                          onClick={() => {
                            if (state.restEnd && remaining > 0) {
                              setRestPaused(remaining);
                              setState((s) => ({ ...s, restEnd: null }));
                            } else startRest(restPaused ?? state.restDuration);
                          }}
                        >
                          {state.restEnd && remaining > 0 ? (
                            <>
                              <Pause size={16} />
                              暂停
                            </>
                          ) : (
                            <>
                              <Play size={16} />
                              {restPaused !== null ? "继续" : "开始休息"}
                            </>
                          )}
                        </button>
                      </div>
                      <p className="timer-note">
                        勾选完成一组，自动开始对应休息。
                        <br />
                        iPhone 锁屏时提醒可能受系统限制。
                      </p>
                    </div>
                    <div className="note-card">
                      <span className="mini-label">TRAINING NOTES</span>
                      <h3>练得扎实，进步自然发生。</h3>
                      <ul>
                        <li>杠铃重量包含杆，哑铃记录单只重量。</li>
                        <li>每腿、每侧的次数分别完成后，再勾选整组。</li>
                        <li>RPE 与原计划提示保留在动作下方。</li>
                      </ul>
                      <div className="note-foot">
                        <ShieldCheck size={15} /> 无云端同步 · 建议定期备份
                      </div>
                    </div>
                    <button
                      className="backup-shortcut"
                      onClick={() =>
                        download(
                          backup(state),
                          `court-backup-${new Date().toISOString().slice(0, 10)}.json`,
                        )
                      }
                    >
                      <ArrowDownToLine size={18} />
                      <span>
                        备份训练数据<small>把你的进步，随身带走</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  </aside>
                </div>
              )}
              {tab === "历史" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>训练记录</h2>
                    <span>
                      {finished.length} 次已完成 ·{" "}
                      {active ? "1 次进行中" : "暂无进行中的训练"}
                    </span>
                  </div>
                  {active && (
                    <button className="resume" onClick={() => setTab("训练")}>
                      <Play size={17} />
                      继续：{active.name}
                      <ChevronRight size={17} />
                    </button>
                  )}
                  {!finished.length ? (
                    <Empty
                      icon={<History size={34} />}
                      title="你的第一条训练记录，正在路上"
                      text="开始一个训练日，完成组数后点击“结束并保存”。"
                    />
                  ) : (
                    <div className="history-list">
                      {[...finished].reverse().map((s) => (
                        <button key={s.id} onClick={() => setDetail(s)}>
                          <span className="history-date">
                            {date(s.startedAt)}
                            <small>{new Date(s.startedAt).getFullYear()}</small>
                          </span>
                          <span className="history-name">
                            <b>{s.name}</b>
                            <small>
                              {s.exercises.reduce(
                                (n, e) =>
                                  n + e.logs.filter((l) => l.done).length,
                                0,
                              )}{" "}
                              /{" "}
                              {s.exercises.reduce(
                                (n, e) => n + e.logs.length,
                                0,
                              )}{" "}
                              组完成 ·{" "}
                              {Math.max(
                                1,
                                Math.round(
                                  (Date.parse(s.finishedAt!) -
                                    Date.parse(s.startedAt)) /
                                    60000,
                                ),
                              )}{" "}
                              分钟
                            </small>
                          </span>
                          <span>
                            {volume(s).toLocaleString()} kg{" "}
                            <ChevronRight size={18} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {tab === "进步" && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>力量进步曲线</h2>
                    <select
                      aria-label="选择曲线动作"
                      value={chartId}
                      onChange={(e) => setChartId(e.target.value)}
                    >
                      {[
                        ...new Map(
                          [
                            ...state.plans.flatMap((p) => p.exercises),
                            ...finished.flatMap((s) => s.exercises),
                          ].map((e) => [e.id, e]),
                        ).values(),
                      ].map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ProgressChart sessions={finished} exerciseId={chartId} />
                  <p className="muted">
                    按每次训练中已完成组的最大重量（kg）显示；自重或未填写重量的组不计入曲线。哑铃为单只重量。
                  </p>
                </section>
              )}
              {tab === "设置" && (
                <div className="settings-grid">
                  <section className="panel">
                    <div className="card-label">
                      <ShieldCheck />
                      <h2>本地数据与备份</h2>
                    </div>
                    <p>
                      训练记录保存在这台设备的 IndexedDB
                      中，不上传个人数据。清除网站数据、卸载或系统回收存储可能导致记录丢失，请定期备份。
                    </p>
                    <div className="settings-item">
                      <div>
                        <h3>导出完整备份</h3>
                        <p>包含训练模板、历史记录和未完成训练。</p>
                      </div>
                      <button
                        className="primary"
                        onClick={() =>
                          download(
                            backup(state),
                            `court-backup-${new Date().toISOString().slice(0, 10)}.json`,
                          )
                        }
                      >
                        <ArrowDownToLine size={16} />
                        导出 JSON
                      </button>
                    </div>
                    <div className="settings-item">
                      <div>
                        <h3>从备份恢复</h3>
                        <p>先校验文件，再确认替换；建议先导出当前数据。</p>
                      </div>
                      <label className="secondary file-button">
                        <ArrowUpFromLine size={16} />
                        选择备份
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => {
                            void importFile(e.target.files?.[0], "backup");
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <div className="settings-item">
                      <div>
                        <h3>申请持久存储</h3>
                        <p>减少被浏览器自动清理的可能，仍需定期备份。</p>
                      </div>
                      <button
                        className="secondary"
                        onClick={async () => {
                          const ok = await navigator.storage
                            ?.persist?.()
                            .catch(() => false);
                          setMessage(
                            ok
                              ? "已启用持久存储。"
                              : "浏览器暂未授予持久存储，请定期备份。",
                          );
                        }}
                      >
                        申请保护
                      </button>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>训练计划</h2>
                    <p>
                      已内置你提供的 4
                      个训练模板。导入只替换模板，训练历史保留。相同动作沿用相同
                      ID，才能关联上次记录。
                    </p>
                    <div className="button-row">
                      <button
                        className="secondary"
                        onClick={() =>
                          download({ plans: state.plans }, "court-plans.json")
                        }
                      >
                        <ArrowDownToLine size={16} />
                        导出计划格式
                      </button>
                      <label className="secondary file-button">
                        <Plus size={16} />
                        导入计划
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => {
                            void importFile(e.target.files?.[0], "plan");
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <p className="muted">
                      按导出的 JSON
                      编辑动作、组数、次数、重量与休息秒数。没有给定重量的动作保留空值，不替你指定负重。
                    </p>
                  </section>
                  <section className="panel install-panel">
                    <div>
                      <div className="eyebrow">TAKE COURT WITH YOU</div>
                      <h2>把训练场，装进口袋。</h2>
                      <p>
                        iPhone：用 Safari 打开 HTTPS 地址 → 分享 → 添加到主屏幕
                        →
                        添加。首次联网打开后，等顶部显示“离线已就绪”，再断网测试。
                      </p>
                      <p>
                        Windows：安装 Node.js 后，在项目目录运行 pnpm install 和
                        pnpm dev；也可在 Edge 中安装此应用。
                      </p>
                      <p className="muted">
                        换手机：旧手机导出备份 → 保存至“文件” →
                        新手机打开同一地址并恢复
                        JSON。安装后请在主屏幕应用里导入备份。
                      </p>
                    </div>
                    <span className="install-logo">C.</span>
                  </section>
                </div>
              )}
              <footer>
                <span>
                  COURT. <b>把每一组练成你的底气。</b>
                </span>
                <span>
                  <ShieldCheck size={13} />
                  {saving ? "正在保存…" : "数据仅保存在当前设备"}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav">
        {nav.map((n) => (
          <button
            className={tab === n.name ? "active" : ""}
            key={n.name}
            onClick={() => setTab(n.name)}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>
      {active && (
        <div className="mobile-rest">
          <span>
            <Timer size={16} />
            组间休息
          </span>
          <strong>{fmt(remaining)}</strong>
          <button
            aria-label="移动端休息计时"
            onClick={() => {
              if (state.restEnd && remaining > 0) {
                setRestPaused(remaining);
                setState((s) => ({ ...s, restEnd: null }));
              } else startRest(restPaused ?? state.restDuration);
            }}
          >
            {state.restEnd && remaining > 0 ? (
              <Pause size={17} />
            ) : (
              <Play size={17} />
            )}
          </button>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          <Check size={18} />
          {message}
        </div>
      )}
      {restore && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="确认恢复备份"
          >
            <h2>恢复这份训练备份？</h2>
            <p>
              备份包含 {restore.plans.length} 个模板、{restore.sessions.length}{" "}
              条训练记录。确认后将替换当前设备的全部训练数据，此操作无法撤销。
            </p>
            <div className="button-row">
              <button
                className="secondary"
                onClick={() =>
                  download(backup(state), "court-before-restore.json")
                }
              >
                先备份当前数据
              </button>
              <button className="secondary" onClick={() => setRestore(null)}>
                取消
              </button>
              <button
                className="primary"
                onClick={() => {
                  setState(restore);
                  setSelected(restore.plans[0].id);
                  setWeek(restore.plans[0].week);
                  setRestore(null);
                  setRestPaused(null);
                  setMessage("备份已恢复。");
                }}
              >
                确认替换并恢复
              </button>
            </div>
          </section>
        </div>
      )}
      {detail && (
        <div className="modal-backdrop">
          <section
            className="modal detail"
            role="dialog"
            aria-modal="true"
            aria-label="训练详情"
          >
            <button
              className="close"
              aria-label="关闭详情"
              onClick={() => setDetail(null)}
            >
              <X />
            </button>
            <div className="eyebrow">
              {new Date(detail.startedAt).toLocaleString("zh-CN")}
            </div>
            <h2>{detail.name}</h2>
            {detail.exercises.map((e) => (
              <div className="detail-exercise" key={e.id}>
                <h3>{e.name}</h3>
                <p>{e.note}</p>
                {e.logs.map((l, i) => (
                  <span key={i} className={l.done ? "finished-set" : ""}>
                    {l.done ? "✓" : "○"} 第 {i + 1} 组：
                    {l.weight === null ? "自重/未设" : `${l.weight} kg`} ×{" "}
                    {l.reps} {e.unit}
                    {e.side ? ` / ${e.side}` : ""}
                  </span>
                ))}
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  unit,
  icon,
  text,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{text}</p>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function ProgressChart({
  sessions,
  exerciseId,
}: {
  sessions: Session[];
  exerciseId: string;
}) {
  const points = [...sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .flatMap((s) => {
      const e = s.exercises.find((e) => e.id === exerciseId);
      const logs = e?.logs.filter((l) => l.done && l.weight !== null);
      return logs?.length
        ? [
            {
              id: s.id,
              date: s.startedAt,
              weight: Math.max(...logs.map((l) => l.weight!)),
            },
          ]
        : [];
    });
  if (!points.length)
    return (
      <Empty
        icon={<Activity size={36} />}
        title="力量的变化，从第一组开始"
        text="完成有重量记录的训练后，这里会出现你的进步曲线。"
      />
    );
  const max = Math.max(10, ...points.map((p) => p.weight)) * 1.15;
  return (
    <>
      <div className="chart-summary">
        <span>
          最近最大训练重量{" "}
          <b>
            {points.at(-1)!.weight}
            <small> kg</small>
          </b>
        </span>
        <span>
          累计记录{" "}
          <b>
            {points.length}
            <small> 次</small>
          </b>
        </span>
      </div>
      <div className="chart">
        <svg
          viewBox="0 0 760 280"
          role="img"
          aria-label="每次训练最大完成重量曲线"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line
                x1="48"
                x2="735"
                y1={230 - i * 50}
                y2={230 - i * 50}
                stroke="#e5e9e3"
                strokeDasharray="4 5"
              />
              <text x="5" y={235 - i * 50}>
                {Math.round((max * i) / 4)}
              </text>
            </g>
          ))}
          <polyline
            fill="none"
            stroke="#217750"
            strokeWidth="3"
            points={points
              .map(
                (p, i) =>
                  `${55 + (i * 670) / Math.max(1, points.length - 1)},${230 - (p.weight / max) * 200}`,
              )
              .join(" ")}
          />
          {points.map((p, i) => (
            <g key={p.id}>
              <circle
                cx={55 + (i * 670) / Math.max(1, points.length - 1)}
                cy={230 - (p.weight / max) * 200}
                r="5"
                fill="#217750"
              >
                <title>
                  {date(p.date)} · {p.weight} kg
                </title>
              </circle>
              {(points.length <= 8 || i === 0 || i === points.length - 1) && (
                <text
                  textAnchor="middle"
                  x={55 + (i * 670) / Math.max(1, points.length - 1)}
                  y="263"
                >
                  {date(p.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="chart-records">
        {points.map((p) => (
          <span key={p.id}>
            {date(p.date)} <b>{p.weight} kg</b>
          </span>
        ))}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
