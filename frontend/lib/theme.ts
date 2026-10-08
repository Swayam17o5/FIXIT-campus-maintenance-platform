export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "campus-theme";

export const THEME_SCRIPT = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;
