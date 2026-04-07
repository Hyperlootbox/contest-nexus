(function () {
  const storageKey = "contestNexusTheme";

  function normalizeTheme(value) {
    return value === "dark" ? "dark" : "light";
  }

  function readStoredTheme() {
    try {
      return normalizeTheme(window.localStorage.getItem(storageKey));
    } catch (error) {
      return "light";
    }
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (error) {
      // Ignore storage failures so the toggle still works in-memory.
    }
  }

  function getCurrentTheme() {
    return normalizeTheme(document.documentElement.dataset.theme);
  }

  function updateToggleUi(theme) {
    let isDark = theme === "dark";

    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");

      let label = button.querySelector("[data-theme-toggle-label]");
      if (label) {
        label.textContent = isDark ? "Dark mode" : "Light mode";
      }
    });
  }

  function applyTheme(theme, shouldPersist = true) {
    let nextTheme = normalizeTheme(theme);

    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;

    updateToggleUi(nextTheme);

    if (shouldPersist) {
      writeStoredTheme(nextTheme);
    }

    return nextTheme;
  }

  function toggleTheme() {
    return applyTheme(getCurrentTheme() === "dark" ? "light" : "dark");
  }

  function bindToggles() {
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      if (button.dataset.themeToggleReady === "true") {
        return;
      }

      button.dataset.themeToggleReady = "true";
      button.addEventListener("click", toggleTheme);
    });
  }

  function initTheme() {
    let initialTheme = document.documentElement.dataset.theme || readStoredTheme();
    applyTheme(initialTheme, false);
    bindToggles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme, { once: true });
  } else {
    initTheme();
  }

  window.addEventListener("storage", event => {
    if (event.key !== storageKey) {
      return;
    }

    applyTheme(event.newValue, false);
  });

  window.ThemeController = {
    getTheme: getCurrentTheme,
    setTheme: applyTheme,
    toggleTheme
  };
})();
