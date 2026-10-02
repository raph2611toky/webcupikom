(function () {
  "use strict";

  const root = document.documentElement;

  function getTheme() {
    try {
      return localStorage.getItem("admin-theme") === "dark" ? "dark" : "light";
    } catch (_) {
      return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }
  }

  function setTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", normalized);
    try { localStorage.setItem("admin-theme", normalized); } catch (_) {}
    document.querySelectorAll("#theme-toggle, [data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", normalized === "dark" ? "true" : "false");
      button.setAttribute("title", normalized === "dark" ? "Passer en mode clair" : "Passer en mode sombre");
    });
  }

  function initTheme() {
    setTheme(getTheme());
    document.querySelectorAll("#theme-toggle, [data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => setTheme(getTheme() === "dark" ? "light" : "dark"));
    });
  }

  function initSidebar() {
    const sidebar = document.getElementById("admin-sidebar");
    const menuButton = document.getElementById("mobile-menu-btn");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (!sidebar || !menuButton) return;

    const close = () => {
      sidebar.classList.remove("is-open");
      backdrop?.classList.remove("is-visible");
      menuButton.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      sidebar.classList.add("is-open");
      backdrop?.classList.add("is-visible");
      menuButton.setAttribute("aria-expanded", "true");
    };

    menuButton.addEventListener("click", () => sidebar.classList.contains("is-open") ? close() : open());
    backdrop?.addEventListener("click", close);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    window.addEventListener("resize", () => { if (window.innerWidth > 992) close(); }, { passive: true });
  }

  function initDrawers() {
    [
      ["toggle-filters", "filters-container"],
      ["toggle-date-hierarchy", "date-hierarchy-container"],
    ].forEach(([buttonId, drawerId]) => {
      const button = document.getElementById(buttonId);
      const drawer = document.getElementById(drawerId);
      if (!button || !drawer) return;
      button.addEventListener("click", () => {
        const willOpen = getComputedStyle(drawer).display === "none";
        drawer.style.display = willOpen ? "block" : "none";
        button.setAttribute("aria-expanded", willOpen ? "true" : "false");
        button.classList.toggle("btn-primary", willOpen);
      });
    });
  }

  function initGlobalSearch() {
    const input = document.getElementById("admin-global-search");
    if (!input) return;
    const navItems = Array.from(document.querySelectorAll("#admin-nav .admin-nav__item"));

    input.addEventListener("input", () => {
      const term = input.value.trim().toLocaleLowerCase();
      navItems.forEach((item) => {
        const haystack = (item.dataset.navSearch || item.textContent || "").toLocaleLowerCase();
        item.style.display = !term || haystack.includes(term) ? "flex" : "none";
      });
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const listSearch = document.querySelector('#changelist-search input[name="q"], #changelist-search input[type="search"], #changelist-search input[type="text"]');
      if (listSearch && input.value.trim()) {
        event.preventDefault();
        listSearch.value = input.value.trim();
        listSearch.form?.submit();
        return;
      }
      const visible = navItems.find((item) => getComputedStyle(item).display !== "none");
      if (visible && input.value.trim()) {
        event.preventDefault();
        visible.click();
      }
    });
  }

  function markExternalAdminEnhancements() {
    // Add useful classes without changing Django's behavior.
    document.querySelectorAll(".submit-row input[name='_save']").forEach((el) => el.classList.add("default"));
    document.querySelectorAll(".submit-row a.deletelink").forEach((el) => el.classList.add("btn-danger"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initSidebar();
    initDrawers();
    initGlobalSearch();
    markExternalAdminEnhancements();
  });
})();
