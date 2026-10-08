"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { mounted, theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";
  const label = isDark ? "Light Mode" : "Dark Mode";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="gap-2"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"}
      title={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"}
    >
      {mounted ? (
        isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />
      ) : (
        <span className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{mounted ? label : "Theme"}</span>
    </Button>
  );
}
