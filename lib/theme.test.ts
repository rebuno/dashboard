import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "./theme";

function initializeTheme(savedTheme: string | null, storageFails = false) {
  const classes = new Set(["dark"]);
  const style: { colorScheme?: string } = {};

  runInNewContext(THEME_INIT_SCRIPT, {
    document: {
      documentElement: {
        classList: {
          add: (name: string) => classes.add(name),
          toggle: (name: string, enabled: boolean) => {
            if (enabled) classes.add(name);
            else classes.delete(name);
          },
        },
        style,
      },
    },
    localStorage: {
      getItem: () => {
        if (storageFails) throw new Error("storage unavailable");
        return savedTheme;
      },
    },
  });

  return { classes, style };
}

describe("theme initialization", () => {
  it("defaults to dark when no preference is saved", () => {
    const { classes, style } = initializeTheme(null);

    expect(classes.has("dark")).toBe(true);
    expect(style.colorScheme).toBe("dark");
  });

  it("restores a saved light preference", () => {
    const { classes, style } = initializeTheme("light");

    expect(classes.has("dark")).toBe(false);
    expect(style.colorScheme).toBe("light");
  });

  it("restores a saved dark preference", () => {
    const { classes, style } = initializeTheme("dark");

    expect(classes.has("dark")).toBe(true);
    expect(style.colorScheme).toBe("dark");
  });

  it("keeps the dark default when storage is unavailable", () => {
    const { classes, style } = initializeTheme(null, true);

    expect(classes.has("dark")).toBe(true);
    expect(style.colorScheme).toBe("dark");
  });
});
