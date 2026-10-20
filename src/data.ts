import { openDB } from "idb";
export type Exercise = {
  id: string;
  name: string;
  english: string;
  sets: number;
  reps: number;
  unit: "次" | "秒";
  side?: string;
  weight: number | null;
  equipment: "杠铃" | "哑铃" | "自重" | "器械";
  rest: number;
  note: string;
};
export type Plan = {
  id: string;
  name: string;
  week: number;
  day: string;
  exercises: Exercise[];
};
export type SetLog = { weight: number | null; reps: number; done: boolean };
export type Session = {
  id: string;
  planId: string;
  name: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: (Exercise & { logs: SetLog[] })[];
};
export type State = {
  plans: Plan[];
  sessions: Session[];
  restEnd: number | null;
  restDuration: number;
};
const ex = (
  id: string,
  name: string,
  english: string,
  sets: number,
  reps: number,
  equipment: Exercise["equipment"],
  weight: number | null,
  rest: number,
  note = "",
  side?: string,
  unit: Exercise["unit"] = "次",
): Exercise => ({
  id,
  name,
  english,
  sets,
  reps,
  equipment,
  weight,
  rest,
  note,
  side,
  unit,
});
const lower = (week: number): Exercise[] => [
  ex(
    "jump",
    "原地纵跳",
    "Countermovement Jump",
    week === 1 ? 2 : 3,
    3,
    "自重",
    null,
    120,
    "自重",
  ),
  ex(
    "squat",
    "杠铃深蹲",
    "Barbell Back Squat",
    3,
    5,
    "杠铃",
    week === 1 ? 65 : 67.5,
    180,
    week === 1 ? "杠铃重量包含杆" : "状态良好可 70 kg；杠铃重量包含杆",
  ),
  ex(
    "rdl",
    "罗马尼亚硬拉",
    "Romanian Deadlift",
    2,
    8,
    "杠铃",
    null,
    120,
    week === 1 ? "RPE 6–7" : "RPE 7",
  ),
  ex(
    "split",
    "保加利亚分腿蹲",
    "Bulgarian Split Squat",
    2,
    6,
    "哑铃",
    null,
    90,
    week === 1 ? "自重或轻哑铃" : "轻哑铃",
    "腿",
  ),
  ex(
    "calf",
    "站姿提踵",
    "Standing Calf Raise",
    2,
    12,
    "器械",
    null,
    60,
    "RPE 7",
  ),
];
const upper = (week: number): Exercise[] => [
  ex(
    "bound",
    "侧向跨步跳",
    "Lateral Bound",
    week === 1 ? 2 : 3,
    3,
    "自重",
    null,
    120,
    "自重",
    "侧",
  ),
  ex(
    "bench",
    "杠铃卧推",
    "Barbell Bench Press",
    3,
    8,
    "杠铃",
    week === 1 ? 40 : 42.5,
    180,
    "杠铃重量包含杆",
  ),
  ex(
    "pullup",
    "引体向上",
    "Pull-Up",
    3,
    6,
    "自重",
    null,
    120,
    week === 1 ? "自重，保留 2 次余力" : "自重，6–8 次",
  ),
  ex(
    "step",
    "哑铃登阶",
    "Dumbbell Step-Up",
    2,
    week === 1 ? 6 : 8,
    "哑铃",
    null,
    90,
    "轻哑铃",
    "腿",
  ),
  ex(
    "pallof",
    "帕洛夫抗旋转推",
    "Pallof Press",
    2,
    week === 1 ? 10 : 12,
    "器械",
    null,
    60,
    week === 1 ? "RPE 6–7" : "RPE 7",
    "侧",
  ),
  ex(
    "plank",
    "哥本哈根平板",
    "Copenhagen Plank",
    2,
    week === 1 ? 15 : 20,
    "自重",
    null,
    60,
    "屈膝版本",
    "侧",
    "秒",
  ),
];
export const defaultPlans: Plan[] = [1, 2].flatMap((week) => [
  {
    id: `w${week}-mon`,
    name: `第${week}周 周一｜下肢力量+弹跳`,
    week,
    day: "周一",
    exercises: lower(week),
  },
  {
    id: `w${week}-thu`,
    name: `第${week}周 周四｜上肢+单腿+核心`,
    week,
    day: "周四",
    exercises: upper(week),
  },
]);
export const initialState = (): State => ({
  plans: structuredClone(defaultPlans),
  sessions: [],
  restEnd: null,
  restDuration: 90,
});
const db = () =>
  openDB("court-training", 1, {
    upgrade(db) {
      db.createObjectStore("app");
    },
  });
export async function readState(): Promise<State> {
  return (await (await db()).get("app", "state")) ?? initialState();
}
export async function writeState(state: State) {
  await (await db()).put("app", state, "state");
}
export const lastExercise = (sessions: Session[], exerciseId: string) =>
  [...sessions]
    .filter((s) => s.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((s) => s.exercises)
    .find((e) => e.id === exerciseId && e.logs.some((l) => l.done));
export function createSession(plan: Plan, sessions: Session[]): Session {
  return {
    id: crypto.randomUUID(),
    planId: plan.id,
    name: plan.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises: plan.exercises.map((e) => {
      const last = lastExercise(sessions, e.id);
      return {
        ...e,
        logs: Array.from({ length: e.sets }, (_, i) => ({
          weight:
            e.weight ??
            last?.logs.filter((l) => l.done)[i]?.weight ??
            last?.logs.find((l) => l.done)?.weight ??
            null,
          reps: e.reps,
          done: false,
        })),
      };
    }),
  };
}
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown) =>
  typeof x === "string" && x.length > 0 && x.length < 500;
const num = (x: unknown, min: number, max: number) =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
function assertExercise(x: unknown): asserts x is Exercise {
  if (
    !obj(x) ||
    !str(x.id) ||
    !str(x.name) ||
    typeof x.english !== "string" ||
    !num(x.sets, 1, 30) ||
    !Number.isInteger(x.sets) ||
    !num(x.reps, 1, 3600) ||
    !num(x.rest, 0, 3600) ||
    !["次", "秒"].includes(x.unit as string) ||
    !["杠铃", "哑铃", "自重", "器械"].includes(x.equipment as string) ||
    (x.weight !== null && !num(x.weight, 0, 1000)) ||
    typeof x.note !== "string" ||
    (x.side !== undefined && !["腿", "侧"].includes(x.side as string))
  )
    throw Error("动作字段无效，请使用导出的计划格式。");
}
export function validatePlans(x: unknown): Plan[] {
  if (!Array.isArray(x) || !x.length || x.length > 100)
    throw Error("计划需包含 1–100 个模板。");
  const ids = new Set();
  for (const p of x) {
    if (
      !obj(p) ||
      !str(p.id) ||
      ids.has(p.id) ||
      !str(p.name) ||
      !num(p.week, 1, 52) ||
      !str(p.day) ||
      !Array.isArray(p.exercises) ||
      !p.exercises.length ||
      p.exercises.length > 50
    )
      throw Error("训练模板格式错误或 ID 重复。");
    ids.add(p.id);
    const eids = new Set();
    for (const e of p.exercises) {
      assertExercise(e);
      if (eids.has(e.id)) throw Error("模板内动作 ID 重复。");
      eids.add(e.id);
    }
  }
  return x as Plan[];
}
export function parseBackup(value: unknown): State {
  if (
    !obj(value) ||
    value.app !== "court-training" ||
    value.version !== 1 ||
    !obj(value.data)
  )
    throw Error("不是受支持的 COURT v1 备份。");
  const s = value.data;
  validatePlans(s.plans);
  if (
    !Array.isArray(s.sessions) ||
    s.sessions.length > 20000 ||
    !num(s.restDuration, 0, 3600) ||
    (s.restEnd !== null && !num(s.restEnd, 0, 9e15))
  )
    throw Error("备份记录无效。");
  const ids = new Set();
  for (const item of s.sessions) {
    if (
      !obj(item) ||
      !str(item.id) ||
      ids.has(item.id) ||
      !str(item.planId) ||
      !str(item.name) ||
      typeof item.startedAt !== "string" ||
      !Number.isFinite(Date.parse(item.startedAt)) ||
      (item.finishedAt !== null &&
        (typeof item.finishedAt !== "string" ||
          !Number.isFinite(Date.parse(item.finishedAt)))) ||
      !Array.isArray(item.exercises) ||
      !item.exercises.length ||
      item.exercises.length > 50
    )
      throw Error("训练记录格式错误。");
    ids.add(item.id);
    for (const e of item.exercises) {
      assertExercise(e);
      const logs = (e as Exercise & { logs: unknown }).logs;
      if (!Array.isArray(logs) || logs.length !== e.sets)
        throw Error("组数与记录不一致。");
      for (const l of logs)
        if (
          !obj(l) ||
          (l.weight !== null && !num(l.weight, 0, 1000)) ||
          !num(l.reps, 1, 3600) ||
          typeof l.done !== "boolean"
        )
          throw Error("组记录无效。");
    }
  }
  return structuredClone(s) as State;
}
export const backup = (state: State) => ({
  app: "court-training",
  version: 1,
  exportedAt: new Date().toISOString(),
  data: state,
});
export const volume = (s: Session) =>
  s.exercises.reduce(
    (sum, e) =>
      sum +
      e.logs
        .filter((l) => l.done)
        .reduce(
          (n, l) =>
            n +
            (l.weight ?? 0) *
              l.reps *
              (e.equipment === "哑铃" ? 2 : 1) *
              (e.side ? 2 : 1),
          0,
        ),
    0,
  );
