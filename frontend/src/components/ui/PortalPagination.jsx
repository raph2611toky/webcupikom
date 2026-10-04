import "../../styles/portal-pagination.css";

export default function PortalPagination({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  perPage = 8,
  onPageChange,
  itemLabel = "résultat",
  itemLabelPlural = "résultats",
  className = "",
}) {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePages = Math.max(1, Number(totalPages) || 1);
  const safePage = Math.min(safePages, Math.max(1, Number(page) || 1));
  const start = safeTotal ? (safePage - 1) * perPage + 1 : 0;
  const end = safeTotal ? Math.min(safeTotal, safePage * perPage) : 0;
  const label = safeTotal > 1 ? itemLabelPlural : itemLabel;

  function go(next) {
    const value = Math.min(safePages, Math.max(1, next));
    if (value !== safePage) onPageChange?.(value);
  }

  return (
    <nav className={`portal-pagination ${className}`.trim()} aria-label="Pagination">
      <span className="portal-pagination__count">
        {safeTotal ? `${start}–${end} sur ${safeTotal} ${label}` : `0 ${itemLabelPlural}`}
      </span>
      {safePages > 1 ? (
        <div className="portal-pagination__controls">
          <button type="button" onClick={() => go(safePage - 1)} disabled={safePage <= 1} aria-label="Page précédente">‹</button>
          <span aria-current="page">{safePage} / {safePages}</span>
          <button type="button" onClick={() => go(safePage + 1)} disabled={safePage >= safePages} aria-label="Page suivante">›</button>
        </div>
      ) : null}
    </nav>
  );
}
