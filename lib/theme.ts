export const THEME_STORAGE_KEY = "rebuno.theme";

// This runs before the page paints so a saved light preference never flashes
// the default dark theme during hydration.
export const THEME_INIT_SCRIPT = `
  (() => {
    const root = document.documentElement;
    try {
      const isDark = localStorage.getItem("${THEME_STORAGE_KEY}") !== "light";
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    } catch {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    }
  })();
`;
