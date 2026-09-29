document.addEventListener('DOMContentLoaded', function() {
  // Fonction pour vérifier s'il y a des filtres actifs
  const hasActiveFilters = function() {
    const selectedFilters = document.querySelectorAll('.filter-group li.selected');
    return selectedFilters.length > 0;
  };

  // Fonction pour créer le bouton de filtre
  const createFilterButton = function() {
    const searchForm = document.getElementById('changelist-search');
    if (!searchForm) return;

    // Créer un conteneur pour la recherche et les filtres
    const searchAndFilters = document.createElement('div');
    searchAndFilters.className = 'search-and-filters';
    searchForm.parentNode.insertBefore(searchAndFilters, searchForm);
    searchAndFilters.appendChild(searchForm);

    // Créer le dropdown de filtre
    const filterDropdown = document.createElement('div');
    filterDropdown.className = 'filter-dropdown';
    searchAndFilters.appendChild(filterDropdown);

    // Créer le bouton de filtre
    const filterButton = document.createElement('button');
    filterButton.className = 'filter-button';
    filterButton.type = 'button';
    filterButton.textContent = 'Filtres';

    // Ajouter la classe 'has-active' si des filtres sont actifs
    if (hasActiveFilters()) {
      filterButton.classList.add('has-active');
    }

    filterDropdown.appendChild(filterButton);

    // Déplacer les filtres existants
    const adminFilters = document.querySelector('.admin-filters');
    if (adminFilters) {
      // Déplacer les filtres dans le dropdown
      filterDropdown.appendChild(adminFilters);

      // Créer un conteneur pour les groupes de filtres
      const filterGroupsContainer = document.createElement('div');
      filterGroupsContainer.className = 'filter-groups-container';

      // Déplacer tous les groupes de filtres dans le nouveau conteneur
      const filterGroups = adminFilters.querySelectorAll('.filter-group');
      filterGroups.forEach(group => {
        filterGroupsContainer.appendChild(group);
      });

      // Remplacer le contenu des filtres par le titre et le nouveau conteneur
      const filterTitle = adminFilters.querySelector('h2');
      adminFilters.innerHTML = '';
      if (filterTitle) {
        adminFilters.appendChild(filterTitle);
      }
      adminFilters.appendChild(filterGroupsContainer);

      // Ajouter un gestionnaire d'événements pour le bouton de filtre
      filterButton.addEventListener('click', function() {
        adminFilters.style.display = adminFilters.style.display === 'block' ? 'none' : 'block';
        filterButton.classList.toggle('active');
      });

      // Fermer le dropdown quand on clique ailleurs
      document.addEventListener('click', function(event) {
        if (!filterDropdown.contains(event.target) && adminFilters.style.display === 'block') {
          adminFilters.style.display = 'none';
          filterButton.classList.remove('active');
        }
      });
    }
  };

  // Fonction pour améliorer le bouton d'ajout
  const enhanceAddButton = function() {
    const addLinks = document.querySelectorAll('.object-tools a.addlink');
    addLinks.forEach(link => {
      // Déjà stylé via CSS
    });
  };

  // Fonction pour corriger le problème de défilement
  const fixScrollIssue = function() {
    // S'assurer que le conteneur principal a une hauteur minimale
    const container = document.getElementById('container');
    if (container) {
      container.style.minHeight = '100vh';
    }

    // Fixer l'en-tête du tableau pour qu'il reste visible lors du défilement
    const tableHeaders = document.querySelectorAll('#changelist table thead th');
    tableHeaders.forEach(header => {
      header.style.position = 'sticky';
      header.style.top = '0';
      header.style.zIndex = '1';
      header.style.background = getComputedStyle(header).background;
    });
  };

  // Initialiser
  createFilterButton();
  enhanceAddButton();
  fixScrollIssue();
});
