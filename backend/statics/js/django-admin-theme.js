document.addEventListener("DOMContentLoaded", () => {
  const setupThemeToggle = () => {
    const themeToggle = document.getElementById("theme-toggle")
    if (!themeToggle) return

    const savedTheme = localStorage.getItem("theme")
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      document.documentElement.setAttribute("data-theme", "dark")
      themeToggle.checked = true
    }

    themeToggle.addEventListener("change", function () {
      document.documentElement.style.transition = "background-color 0.35s ease, color 0.35s ease"
      if (this.checked) {
        document.documentElement.setAttribute("data-theme", "dark")
        localStorage.setItem("theme", "dark")
      } else {
        document.documentElement.removeAttribute("data-theme")
        localStorage.setItem("theme", "light")
      }
    })
  }

  const setupMobileMenu = () => {
    const mobileMenuBtn = document.querySelector(".mobile-menu-btn")
    const sidebar = document.querySelector(".sidebar")
    const mainContent = document.querySelector(".main-content")

    if (!mobileMenuBtn || !sidebar || !mainContent) return

    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      sidebar.classList.toggle("open")
    })

    // Close sidebar when a menu item is clicked
    const menuItems = sidebar.querySelectorAll(".menu-item, .menu-item-button")
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth < 992) {
          sidebar.classList.remove("open")
        }
      })
    })

    document.addEventListener("click", (event) => {
      if (
        !sidebar.contains(event.target) &&
        !mobileMenuBtn.contains(event.target) &&
        sidebar.classList.contains("open") &&
        window.innerWidth < 992
      ) {
        sidebar.classList.remove("open")
      }
    })
  }

  const handleResize = () => {
    const sidebar = document.querySelector(".sidebar")
    const mainContent = document.querySelector(".main-content")

    if (!sidebar || !mainContent) return

    if (window.innerWidth < 992) {
      sidebar.classList.remove("open")
      mainContent.style.marginLeft = "0"
    } else {
      mainContent.style.marginLeft = "276px"
    }
  }

  const initStatsAnimation = () => {
    const statCards = document.querySelectorAll(".stat-card")

    statCards.forEach((card, index) => {
      setTimeout(() => {
        card.style.opacity = "1"
        card.style.transform = "translateY(0)"
      }, index * 100)
    })
  }

  const initTableAnimation = () => {
    const tableRows = document.querySelectorAll("tbody tr")

    tableRows.forEach((row, index) => {
      row.style.opacity = "1"
      row.style.transform = "translateX(0)"
    })
  }

  const updateLastUpdateTime = () => {
    const lastUpdateEl = document.getElementById("last-update")
    if (!lastUpdateEl) return

    lastUpdateEl.textContent = "à l'instant"
    setTimeout(() => {
      lastUpdateEl.textContent = "il y a 1 minute"
    }, 60000)
  }

  const setupSearch = () => {
    const searchInput = document.querySelector(".search-input")
    if (!searchInput) return

    searchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase()
      const tableRows = document.querySelectorAll("tbody tr")

      tableRows.forEach((row) => {
        const text = row.textContent.toLowerCase()
        if (text.includes(searchTerm)) {
          row.style.display = ""
        } else {
          row.style.display = "none"
        }
      })
    })
  }

  const enhanceDjangoAdmin = () => {
    const header = document.getElementById("header")
    if (header) {
      const mobileBtn = document.createElement("button")
      mobileBtn.className = "mobile-menu-btn"
      mobileBtn.innerHTML = '<i class="fas fa-bars"></i>'
      header.insertBefore(mobileBtn, header.firstChild)
    }

    const userTools = document.getElementById("user-tools")
    if (userTools) {
      const themeToggleContainer = document.createElement("div")
      themeToggleContainer.className = "theme-toggle-container"
      themeToggleContainer.innerHTML = `
        <span class="mr-2 text-sm">Thème</span>
        <label class="switch">
          <input type="checkbox" id="theme-toggle">
          <span class="slider">
            <i class="fas fa-moon moon"></i>
            <i class="fas fa-sun sun"></i>
          </span>
        </label>
      `
      userTools.appendChild(themeToggleContainer)
    }

    const changeLists = document.querySelectorAll("#changelist-form .results")
    changeLists.forEach((changeList) => {
      changeList.classList.add("data-card")

      const table = changeList.querySelector("table")
      if (table) {
        table.classList.add("table-container")
      }
    })

    const addIcons = () => {
      const iconMap = {
        Accueil: "fa-home",
        Ajouter: "fa-plus",
        Modifier: "fa-edit",
        Supprimer: "fa-trash",
        Voir: "fa-eye",
        Utilisateurs: "fa-users",
        Groupes: "fa-user-friends",
        Paramètres: "fa-cog",
        Déconnexion: "fa-sign-out-alt",
      }

      document.querySelectorAll("a").forEach((link) => {
        const text = link.textContent.trim()
        if (iconMap[text] && !link.querySelector("i")) {
          const icon = document.createElement("i")
          icon.className = `fas ${iconMap[text]} mr-2`
          link.insertBefore(icon, link.firstChild)
        }
      })
    }

    addIcons()
  }

  setupThemeToggle()
  setupMobileMenu()
  handleResize()
  initStatsAnimation()
  initTableAnimation()
  updateLastUpdateTime()
  setupSearch()
  enhanceDjangoAdmin()

  // Add touch-friendly improvements
  document.documentElement.style.webkitTouchCallout = "none"
  document.documentElement.style.userSelect = "none"

  let resizeTimeout
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(handleResize, 150)
  })
})
