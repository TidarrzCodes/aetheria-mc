// =========================================================================
// AETHERIA THEME CONTROLLER (DARK / LIGHT MODE)
// =========================================================================

(function () {
  function getPreferredTheme() {
    const saved = localStorage.getItem('aetheria_theme');
    if (saved) return saved;
    return 'dark'; // Default fantasy gaming mode
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }

    localStorage.setItem('aetheria_theme', theme);
    updateThemeButtons(theme);

    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }

  function updateThemeButtons(theme) {
    const btns = document.querySelectorAll('.theme-toggle-btn, #themeToggleBtn');
    btns.forEach(btn => {
      if (theme === 'light') {
        btn.innerHTML = `<i class="fa-solid fa-moon text-amber-500 text-base leading-none"></i> <span class="hidden sm:inline ml-1.5 text-xs">Dark</span>`;
        btn.setAttribute('title', 'Switch to Dark Mode');
      } else {
        btn.innerHTML = `<i class="fa-solid fa-sun text-amber-400 text-base leading-none"></i> <span class="hidden sm:inline ml-1.5 text-xs">Light</span>`;
        btn.setAttribute('title', 'Switch to Light Mode');
      }
    });
  }

  window.toggleTheme = function () {
    const current = localStorage.getItem('aetheria_theme') === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
  };

  // Immediate execution to prevent FOUC
  const initialTheme = getPreferredTheme();
  if (initialTheme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.add('dark');
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateThemeButtons(getPreferredTheme());
  });
})();
