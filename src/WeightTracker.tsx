import { useState, type FormEvent } from "react";
import { Scale, Pencil, Trash2 } from "lucide-react";
import { validWeightDate, type BodyWeight } from "./data";
export const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export function WeightTracker({
  entries,
  onChange,
}: {
  entries: BodyWeight[];
  onChange: (entries: BodyWeight[]) => void;
}) {
  const [day, setDay] = useState(localToday),
    [kg, setKg] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [removing, setRemoving] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    last = sorted.at(-1),
    change = last ? last.kg - sorted[0].kg : 0;
  function save(event: FormEvent) {
    event.preventDefault();
    const value = Number(kg);
    if (
      !validWeightDate(day) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 500
    ) {
      setMessage("请填写有效日期和体重。");
      return;
    }
    onChange([
      ...entries.filter((e) => e.date !== day),
      { date: day, kg: value, note: note.trim() },
    ]);
    setMessage(
      entries.some((e) => e.date === day) ? "已更新当天体重。" : "体重已保存。",
    );
    setKg("");
    setNote("");
  }
  const low = sorted.length ? Math.min(...sorted.map((e) => e.kg)) - 1 : 0,
    high = sorted.length ? Math.max(...sorted.map((e) => e.kg)) + 1 : 1;
  const firstTime = sorted.length ? Date.parse(sorted[0].date) : 0,
    lastTime = last ? Date.parse(last.date) : firstTime;
  const x = (entry: BodyWeight) =>
    lastTime === firstTime
      ? 390
      : 55 +
        ((Date.parse(entry.date) - firstTime) / (lastTime - firstTime)) * 670;
  const y = (entry: BodyWeight) =>
    230 - ((entry.kg - low) / (high - low)) * 190;
  return (
    <section className="panel weight-tracker">
      <div className="card-label">
        <Scale size={20} />
        <h2>体重变化</h2>
      </div>
      <p className="muted">
        按日期记录实际测量值。同一天再次保存会更新当天记录；只展示变化，不设置目标或评价升降。
      </p>
      <div className="weight-summary">
        <div>
          最近体重
          <strong>
            {last ? last.kg : "—"}
            <small> kg</small>
          </strong>
        </div>
        <div>
          较首次变化
          <strong>
            {last ? `${change > 0 ? "+" : ""}${change.toFixed(1)}` : "—"}
            <small> kg</small>
          </strong>
        </div>
        <div>
          已记录
          <strong>
            {sorted.length}
            <small> 天</small>
          </strong>
        </div>
      </div>
      <form onSubmit={save} className="weight-form">
        <label>
          记录日期
          <input
            required
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label>
          体重 kg
          <input
            required
            type="number"
            min="0.1"
            max="500"
            step="0.1"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="填写实际体重"
          />
        </label>
        <label className="weight-note">
          体重备注
          <input
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：晨起测量"
          />
        </label>
        <button className="primary" type="submit">
          保存体重
        </button>
      </form>
      {message && (
        <p className="weight-message" role="status">
          {message}
        </p>
      )}
      {sorted.length ? (
        <>
          <div className="chart">
            <svg
              viewBox="0 0 760 280"
              role="img"
              aria-label="按日期记录的体重变化曲线"
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={i}>
                  <line
                    x1="48"
                    x2="735"
                    y1={230 - i * 47.5}
                    y2={230 - i * 47.5}
                    stroke="#ecd6e1"
                    strokeDasharray="4 5"
                  />
                  <text x="5" y={235 - i * 47.5}>
                    {(low + ((high - low) * i) / 4).toFixed(1)}
                  </text>
                </g>
              ))}
              <polyline
                fill="none"
                stroke="#b55380"
                strokeWidth="3"
                points={sorted.map((e) => `${x(e)},${y(e)}`).join(" ")}
              />
              {sorted.map((e, i) => (
                <g key={e.date}>
                  <circle cx={x(e)} cy={y(e)} r="5" fill="#b55380">
                    <title>
                      {e.date} · {e.kg} kg
                    </title>
                  </circle>
                  {(sorted.length <= 6 ||
                    i === 0 ||
                    i === sorted.length - 1) && (
                    <text x={x(e)} y="263" textAnchor="middle">
                      {e.date.slice(5)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          <div className="weight-records">
            {[...sorted].reverse().map((entry) => (
              <div className="weight-record" key={entry.date}>
                <div>
                  <strong>{entry.date}</strong>
                  <span>{entry.note || "无备注"}</span>
                </div>
                <b>{entry.kg} kg</b>
                <button
                  className="secondary"
                  aria-label={`编辑${entry.date}体重`}
                  onClick={() => {
                    setDay(entry.date);
                    setKg(String(entry.kg));
                    setNote(entry.note);
                    setMessage("修改后点击“保存体重”更新。");
                  }}
                >
                  <Pencil size={14} />
                </button>
                {removing === entry.date ? (
                  <>
                    <button
                      className="secondary"
                      onClick={() => {
                        onChange(entries.filter((e) => e.date !== entry.date));
                        setRemoving(null);
                        setMessage("该条体重记录已删除。");
                      }}
                    >
                      确认删除
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setRemoving(null)}
                    >
                      保留
                    </button>
                  </>
                ) : (
                  <button
                    className="secondary"
                    aria-label={`删除${entry.date}体重`}
                    onClick={() => setRemoving(entry.date)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty">
          <Scale size={34} />
          <h3>从一次测量开始记录</h3>
          <p>保存体重后，这里会显示变化曲线。</p>
        </div>
      )}
    </section>
  );
}
