import "../../styles/portal-pagination.css";

function pageWindow(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);

  const values = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...values].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b);
  const output = [];

  pages.forEach((value, index) => {
    const previous = pages[index - 1];
    if (previous && value - previous > 1) output.push(`gap-${previous}-${value}`);
    output.push(value);
  });

  return output;
}

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
  const safePerPage = Math.max(1, Number(perPage) || 8);
  const start = safeTotal ? (safePage - 1) * safePerPage + 1 : 0;
  const end = safeTotal ? Math.min(safeTotal, safePage * safePerPage) : 0;
  const label = safeTotal > 1 ? itemLabelPlural : itemLabel;
  const pages = pageWindow(safePage, safePages);

  function go(next) {
    const value = Math.min(safePages, Math.max(1, Number(next) || 1));
    if (value !== safePage) onPageChange?.(value);
  }

  return (
    <nav className={`portal-pagination ${className}`.trim()} aria-label="Pagination">
      <span className="portal-pagination__count">
        {safeTotal ? `${start}–${end} sur ${safeTotal} ${label}` : `0 ${itemLabelPlural}`}
      </span>

      <div className="portal-pagination__controls">
        <button
          type="button"
          className="portal-pagination__nav"
          onClick={() => go(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Page précédente"
        >‹</button>

        <div className="portal-pagination__numbers" aria-label={`Page ${safePage} sur ${safePages}`}>
          {pages.map((value) => typeof value === "number" ? (
            <button
              key={value}
              type="button"
              className={`portal-pagination__number${value === safePage ? " is-active" : ""}`}
              aria-current={value === safePage ? "page" : undefined}
              onClick={() => go(value)}
            >{value}</button>
          ) : <span className="portal-pagination__ellipsis" key={value} aria-hidden="true">…</span>)}
        </div>

        <button
          type="button"
          className="portal-pagination__nav"
          onClick={() => go(safePage + 1)}
          disabled={safePage >= safePages}
          aria-label="Page suivante"
        >›</button>
      </div>
    </nav>
  );
}
