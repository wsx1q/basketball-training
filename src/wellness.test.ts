import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  initialState,
  backup,
  parseBackup,
  normalizeState,
  profileOf,
  updateProfile,
  createSession,
  caloriesOf,
  validFollowUrl,
  readState,
  writeState,
  type State,
} from "./data";
describe("粉色跟练、体重与旧数据兼容", () => {
  it("旧版 v1 和旧 IndexedDB 数据保留篮球历史并补齐独立跟练资料", async () => {
    const state = initialState(),
      legacy = {
        plans: state.plans,
        sessions: [createSession(state.plans[0], [])],
        restEnd: null,
        restDuration: 90,
      };
    legacy.sessions[0].finishedAt = new Date().toISOString();
    const upgraded = normalizeState(
      parseBackup({ app: "court-training", version: 1, data: legacy }),
    );
    expect(upgraded.sessions).toEqual(legacy.sessions);
    expect(upgraded.mode).toBe("basketball");
    expect(upgraded.wellness!.plans).toHaveLength(1);
    expect(upgraded.bodyWeights).toEqual([]);
    await writeState(legacy);
    const stored = await readState();
    expect(stored.sessions).toEqual(legacy.sessions);
    expect(stored.wellness!.sessions).toEqual([]);
  });
  it("两个模式互不改写，跟练组保留次数且不自动推算大卡", () => {
    let state = initialState();
    const original = structuredClone(state.plans);
    const plan = profileOf(state, "wellness").plans[0];
    const session = createSession(plan, []);
    expect(session.kind).toBe("calories");
    expect(session.exercises[0].logs[0]).toMatchObject({
      reps: 1,
      calories: null,
      done: false,
    });
    session.exercises[0].logs[0] = {
      weight: null,
      reps: 12,
      calories: 80,
      done: true,
    };
    state = updateProfile(state, "wellness", (p) => ({
      ...p,
      sessions: [session],
    }));
    expect(state.plans).toEqual(original);
    expect(state.sessions).toEqual([]);
    expect(caloriesOf(session)).toBe(80);
    session.exercises[0].logs[0].done = false;
    expect(caloriesOf(session)).toBe(0);
  });
  it("v2 备份往返保留跟练链接、消耗大卡、体重和模式，拒绝不安全链接和异常体重", () => {
    const state = initialState();
    state.mode = "wellness";
    state.wellness!.plans[0].followUrl = "https://example.com/course";
    const s = createSession(state.wellness!.plans[0], []);
    s.exercises[0].logs[0].calories = 125.5;
    state.wellness!.sessions = [s];
    state.bodyWeights = [{ date: "2026-10-19", kg: 55.2, note: "晨起测量" }];
    expect(backup(state).version).toBe(2);
    expect(parseBackup(JSON.parse(JSON.stringify(backup(state))))).toEqual(
      state,
    );
    expect(validFollowUrl("javascript:alert(1)")).toBe(false);
    expect(validFollowUrl("https://user:password@example.com")).toBe(false);
    expect(validFollowUrl("https://example.com/course")).toBe(true);
    const broken = structuredClone(state);
    broken.wellness!.plans[0].followUrl = "javascript:alert(1)";
    expect(() => parseBackup(backup(broken))).toThrow();
    for (const entry of [
      { date: "2026-02-30", kg: 55, note: "" },
      { date: "2026-10-19", kg: -1, note: "" },
    ]) {
      const invalid = { ...state, bodyWeights: [entry] };
      expect(() => parseBackup(backup(invalid))).toThrow();
    }
    const badCalories = structuredClone(state);
    badCalories.wellness!.sessions[0].exercises[0].logs[0].calories = -1;
    expect(() => parseBackup(backup(badCalories))).toThrow();
  });
});
