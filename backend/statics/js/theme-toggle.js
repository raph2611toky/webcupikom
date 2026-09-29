document.addEventListener("DOMContentLoaded", function () {
  const html = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const sidebar = document.getElementById("admin-sidebar");

  const savedTheme = localStorage.getItem("admin-theme");

  if (savedTheme === "dark") {
    html.setAttribute("data-theme", "dark");
    if (toggle) toggle.checked = true;
  } else if (savedTheme === "light") {
    html.setAttribute("data-theme", "light");
    if (toggle) toggle.checked = false;
  } else {
    html.setAttribute("data-theme", "light");
    if (toggle) toggle.checked = false;
  }

  if (toggle) {
    toggle.addEventListener("change", function () {
      const theme = this.checked ? "dark" : "light";
      html.setAttribute("data-theme", theme);
      localStorage.setItem("admin-theme", theme);
    });
  }

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });

    document.addEventListener("click", function (e) {
      if (
        window.innerWidth <= 992 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(e.target) &&
        !mobileMenuBtn.contains(e.target)
      ) {
        sidebar.classList.remove("open");
      }
    });
  }

  const filtersBtn = document.getElementById("toggle-filters");
  const filtersContainer = document.getElementById("filters-container");
  if (filtersBtn && filtersContainer) {
    filtersBtn.addEventListener("click", function () {
      filtersContainer.style.display =
        filtersContainer.style.display === "none" || !filtersContainer.style.display
          ? "block"
          : "none";
    });
  }

  const dateBtn = document.getElementById("toggle-date-hierarchy");
  const dateContainer = document.getElementById("date-hierarchy-container");
  if (dateBtn && dateContainer) {
    dateBtn.addEventListener("click", function () {
      dateContainer.style.display =
        dateContainer.style.display === "none" || !dateContainer.style.display
          ? "block"
          : "none";
    });
  }

  const changelistSearch = document.getElementById("changelist-search");
  if (changelistSearch) {
    const textInput = changelistSearch.querySelector('input[type="text"]');
    if (textInput && !textInput.closest(".search-container")) {
      const wrapper = document.createElement("div");
      wrapper.className = "search-container";

      const icon = document.createElement("i");
      icon.className = "fas fa-search search-icon";

      textInput.parentNode.insertBefore(wrapper, textInput);
      wrapper.appendChild(icon);
      wrapper.appendChild(textInput);

      textInput.classList.add("search-input");
      textInput.setAttribute("placeholder", "Rechercher...");
    }

    const submitInput = changelistSearch.querySelector('input[type="submit"]');
    if (submitInput) {
      submitInput.classList.add("btn", "btn-primary");
      submitInput.value = submitInput.value || "Rechercher";
    }
  }
});
