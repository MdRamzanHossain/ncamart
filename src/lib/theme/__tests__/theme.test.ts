import { describe, it, expect } from "vitest";
import { ThemeScript } from "../theme-script";

describe("F01 — Core Design System & Theme Engine", () => {
  it("ThemeScript renders inline script without error", () => {
    const element = ThemeScript();
    expect(element).toBeDefined();
    expect(element.type).toBe("script");
    expect(element.props.id).toBe("nca-theme-script");
    expect(element.props.dangerouslySetInnerHTML.__html).toContain("data-theme");
  });

  it("exports theme types and components cleanly", async () => {
    const themeModule = await import("../index");
    expect(themeModule.ThemeProvider).toBeDefined();
    expect(themeModule.ThemeToggle).toBeDefined();
    expect(themeModule.ThemeCycleButton).toBeDefined();
    expect(themeModule.useTheme).toBeDefined();
  });
});
