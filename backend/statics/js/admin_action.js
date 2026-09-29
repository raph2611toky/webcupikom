function toggleActive(userId) {
    if (confirm("Êtes-vous sûr de vouloir changer le statut de cet utilisateur ?")) {
        window.location.href = `/admin/user/user/${userId}/toggle_active/`;
    }
}
