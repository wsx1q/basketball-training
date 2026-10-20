import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { validatePlans, type Exercise, type Plan } from "./data";

export function TemplateEditor({
  plan,
  onSave,
  onCancel,
}: {
  plan: Plan;
  onSave: (plan: Plan) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(plan));
  const [error, setError] = useState("");
  const calories = draft.kind === "calories";
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function edit(id: string, patch: Partial<Exercise>) {
    setDraft((p) => ({
      ...p,
      exercises: p.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }
  function move(index: number, offset: number) {
    setDraft((p) => {
      const exercises = [...p.exercises];
      [exercises[index], exercises[index + offset]] = [
        exercises[index + offset],
        exercises[index],
      ];
      return { ...p, exercises };
    });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    try {
      const cleaned = {
        ...draft,
        name: draft.name.trim(),
        exercises: draft.exercises.map((e) => ({
          ...e,
          name: e.name.trim(),
          english: e.english.trim(),
          note: e.note.trim(),
          followUrl: e.followUrl?.trim(),
        })),
        followUrl: draft.followUrl?.trim(),
      };
      validatePlans([cleaned]);
      onSave(cleaned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请检查模板内容。");
    }
  }
  return (
    <dialog
      ref={dialog}
      className="modal template-editor"
      aria-labelledby="editor-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form onSubmit={save}>
        <div className="editor-heading">
          <div>
            <div className="eyebrow">MAKE IT YOUR TRAINING</div>
            <h2 id="editor-title">编辑训练模板</h2>
          </div>
          <button
            type="button"
            className="secondary"
            aria-label="关闭模板编辑"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>
        <p className="editor-hint">
          修改用于下一次训练，当前训练与历史保持原样。调整原动作会保留重量关联；更换为另一种动作请删除后添加。
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <div className="editor-fields template-fields">
          <label className="wide">
            模板名称
            <input
              autoFocus
              required
              maxLength={200}
              value={draft.name}
              onChange={(e) =>
                setDraft((p) => ({ ...p, name: e.target.value }))
              }
            />
          </label>
          <label>
            第几周
            <input
              required
              type="number"
              min="1"
              max="52"
              step="1"
              inputMode="numeric"
              value={draft.week}
              onChange={(e) =>
                setDraft((p) => ({ ...p, week: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            训练日
            <select
              value={draft.day}
              onChange={(e) => setDraft((p) => ({ ...p, day: e.target.value }))}
            >
              {[
                ...new Set([
                  draft.day,
                  "周一",
                  "周二",
                  "周三",
                  "周四",
                  "周五",
                  "周六",
                  "周日",
                ]),
              ].map((day) => (
                <option key={day}>{day}</option>
              ))}
            </select>
          </label>
        </div>
        {calories && (
          <label className="editor-link-field">
            模板跟练链接
            <input
              type="url"
              maxLength={2048}
              value={draft.followUrl ?? ""}
              placeholder="https://…"
              onChange={(e) =>
                setDraft((p) => ({ ...p, followUrl: e.target.value }))
              }
            />
          </label>
        )}
        <div className="editor-exercises">
          {draft.exercises.map((exercise, i) => (
            <fieldset key={exercise.id} className="editor-exercise">
              <legend>
                {String(i + 1).padStart(2, "0")} · {exercise.name || "新动作"}
              </legend>
              <div className="exercise-tools">
                <button
                  type="button"
                  className="secondary"
                  disabled={i === 0}
                  aria-label={`上移第${i + 1}个动作`}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={i === draft.exercises.length - 1}
                  aria-label={`下移第${i + 1}个动作`}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="secondary remove-exercise"
                  disabled={draft.exercises.length === 1}
                  aria-label={`删除第${i + 1}个动作`}
                  onClick={() =>
                    setDraft((p) => ({
                      ...p,
                      exercises: p.exercises.filter(
                        (e) => e.id !== exercise.id,
                      ),
                    }))
                  }
                >
                  <Trash2 size={15} />
                  删除
                </button>
              </div>
              <div className="editor-fields">
                <label className="wide">
                  动作名称
                  <input
                    required
                    maxLength={150}
                    value={exercise.name}
                    onChange={(e) =>
                      edit(exercise.id, { name: e.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  英文名称（可选）
                  <input
                    maxLength={200}
                    value={exercise.english}
                    onChange={(e) =>
                      edit(exercise.id, { english: e.target.value })
                    }
                  />
                </label>
                <label>
                  组数
                  <input
                    required
                    type="number"
                    min="1"
                    max="30"
                    step="1"
                    inputMode="numeric"
                    value={exercise.sets}
                    onChange={(e) =>
                      edit(exercise.id, { sets: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  每组次数 / 秒
                  <input
                    required
                    type="number"
                    min="1"
                    max="3600"
                    step="1"
                    inputMode="numeric"
                    value={exercise.reps}
                    onChange={(e) =>
                      edit(exercise.id, { reps: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  计量单位
                  <select
                    value={exercise.unit}
                    onChange={(e) =>
                      edit(exercise.id, {
                        unit: e.target.value as Exercise["unit"],
                      })
                    }
                  >
                    <option>次</option>
                    <option>秒</option>
                  </select>
                </label>
                <label>
                  完成范围
                  <select
                    value={exercise.side ?? ""}
                    onChange={(e) =>
                      edit(exercise.id, { side: e.target.value || undefined })
                    }
                  >
                    <option value="">整组</option>
                    <option value="腿">每腿</option>
                    <option value="侧">每侧</option>
                  </select>
                </label>
                {!calories && (
                  <label>
                    器械
                    <select
                      value={exercise.equipment}
                      onChange={(e) =>
                        edit(exercise.id, {
                          equipment: e.target.value as Exercise["equipment"],
                        })
                      }
                    >
                      {["杠铃", "哑铃", "自重", "器械"].map((eq) => (
                        <option key={eq}>{eq}</option>
                      ))}
                    </select>
                  </label>
                )}
                {!calories && (
                  <label>
                    重量 kg
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="any"
                      inputMode="decimal"
                      placeholder="自重或沿用上次"
                      value={exercise.weight ?? ""}
                      onChange={(e) =>
                        edit(exercise.id, {
                          weight:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
                <label>
                  组间休息（秒）
                  <input
                    required
                    type="number"
                    min="0"
                    max="3600"
                    step="1"
                    inputMode="numeric"
                    value={exercise.rest}
                    onChange={(e) =>
                      edit(exercise.id, { rest: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="full">
                  {calories
                    ? "课程备注 / 次数说明"
                    : "动作说明 / RPE / 次数范围"}
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={exercise.note}
                    onChange={(e) =>
                      edit(exercise.id, { note: e.target.value })
                    }
                  />
                </label>
                {calories && (
                  <label className="full">
                    动作跟练链接
                    <input
                      type="url"
                      maxLength={2048}
                      value={exercise.followUrl ?? ""}
                      placeholder="可选：单独动作的视频链接"
                      onChange={(e) =>
                        edit(exercise.id, { followUrl: e.target.value })
                      }
                    />
                  </label>
                )}
              </div>
            </fieldset>
          ))}
        </div>
        <button
          className="secondary"
          type="button"
          disabled={draft.exercises.length >= 50}
          onClick={() =>
            setDraft((p) => ({
              ...p,
              exercises: [
                ...p.exercises,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  english: "",
                  sets: calories ? 1 : 3,
                  reps: calories ? 1 : 8,
                  unit: "次",
                  equipment: "自重",
                  weight: null,
                  rest: calories ? 60 : 90,
                  note: "",
                },
              ],
            }))
          }
        >
          <Plus size={16} />
          添加动作
        </button>
        <p className="editor-hint">
          {calories
            ? "每组保留次数或秒数；消耗大卡在训练时按实际情况填写，不预设消耗。可保存课程及单独动作的跟练链接。"
            : "杠铃填写含杆总重，哑铃填写单只重量。重量留空表示自重或开始训练时沿用上次重量；次数范围可写在说明中。"}
        </p>
        <div className="editor-footer">
          <span>仅保存在当前设备</span>
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
          <button className="primary" type="submit">
            保存模板
          </button>
        </div>
      </form>
    </dialog>
  );
}
