import type { CSSProperties } from "react";
export type ThemeColors = {
  background: string;
  surface: string;
  accent: string;
  banner: string;
  text: string;
};
export const defaultColors: ThemeColors = {
  background: "#fff2f7",
  surface: "#fff0f3",
  accent: "#c94360",
  banner: "#ffb6c8",
  text: "#713342",
};
export function validColors(value: unknown): value is ThemeColors {
  return (
    !!value &&
    typeof value === "object" &&
    Object.keys(defaultColors).every((key) =>
      /^#[0-9a-f]{6}$/i.test((value as Record<string, string>)[key] ?? ""),
    )
  );
}
function ink(color: string) {
  const rgb = [1, 3, 5].map((i) => {
    const n = parseInt(color.slice(i, i + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
    ? "#24191c"
    : "#ffffff";
}
export function paletteStyle(colors?: ThemeColors): CSSProperties | undefined {
  if (!colors) return;
  return {
    ...Object.fromEntries(
      Object.entries(colors).map(([key, value]) => [`--palette-${key}`, value]),
    ),
    "--palette-on-accent": ink(colors.accent),
    "--palette-on-banner": ink(colors.banner),
  } as CSSProperties;
}
const fields: [keyof ThemeColors, string][] = [
  ["background", "页面背景"],
  ["surface", "卡片与弹窗"],
  ["accent", "重点色 · 按钮与计时环"],
  ["banner", "训练横幅"],
  ["text", "正文与标题"],
];
export function ThemePalette({
  colors,
  onChange,
}: {
  colors?: ThemeColors;
  onChange: (colors?: ThemeColors) => void;
}) {
  const current = colors ?? defaultColors;
  return (
    <section className="panel theme-palette">
      <h2>我的调色盘</h2>
      <p>
        点击色块选择颜色，页面实时预览并自动保存。仅用于女生版，配色也会包含在
        JSON 备份中。
      </p>
      <div className="palette-fields">
        {fields.map(([key, label]) => (
          <label key={key}>
            <input
              type="color"
              aria-label={label}
              value={current[key]}
              onChange={(e) => onChange({ ...current, [key]: e.target.value })}
            />
            <span>
              {label}
              <small>{current[key].toUpperCase()}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="button-row">
        <button
          className="secondary"
          onClick={() =>
            onChange({
              ...defaultColors,
              background: "#fff0f4",
              surface: "#fff8fa",
              accent: "#cb4260",
              banner: "#ffc4d3",
            })
          }
        >
          樱花粉
        </button>
        <button
          className="secondary"
          onClick={() =>
            onChange({
              background: "#fff3ec",
              surface: "#fffaf5",
              accent: "#b94c38",
              banner: "#ffc9af",
              text: "#703c30",
            })
          }
        >
          蜜桃粉
        </button>
        <button className="secondary" onClick={() => onChange(undefined)}>
          恢复默认配色
        </button>
      </div>
    </section>
  );
}
