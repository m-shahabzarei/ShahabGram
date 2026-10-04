type Row = Record<string, any>;
type Filter = { field: string; value: unknown; operation: "eq" | "neq" | "is" | "gt" | "gte" | "in" };

export function conversationDatabase(tables: Record<string, Row[]>, options: { errorTable?: string; beforeUpdate?: (tables: Record<string, Row[]>) => void } = {}) {
  const updates: { table: string; values: Row }[] = [];
  let beforeUpdate = options.beforeUpdate;
  const from = (table: string) => {
    const filters: Filter[] = [];
    let values: Row | undefined;
    let count = false;
    let single = false;
    let orderField = "";
    let ascending = true;
    let limit = Infinity;
    const query = {
      select(_fields: string, config?: { count?: string; head?: boolean }) { count = config?.count === "exact"; return query; },
      eq(field: string, value: unknown) { filters.push({ field, value, operation: "eq" }); return query; },
      neq(field: string, value: unknown) { filters.push({ field, value, operation: "neq" }); return query; },
      is(field: string, value: unknown) { filters.push({ field, value, operation: "is" }); return query; },
      gt(field: string, value: unknown) { filters.push({ field, value, operation: "gt" }); return query; },
      gte(field: string, value: unknown) { filters.push({ field, value, operation: "gte" }); return query; },
      in(field: string, value: unknown[]) { filters.push({ field, value, operation: "in" }); return query; },
      order(field: string, config?: { ascending?: boolean }) { orderField = field; ascending = config?.ascending ?? true; return query; },
      limit(value: number) { limit = value; return query; },
      update(next: Row) { values = next; return query; },
      maybeSingle() { single = true; return query; },
      then(resolve: (value: { data: any; error: unknown; count: number | null }) => unknown) {
        if (options.errorTable === table) return Promise.resolve(resolve({ data: null, error: { message: "Database failure" }, count: null }));
        if (values && beforeUpdate) { const apply = beforeUpdate; beforeUpdate = undefined; apply(tables); }
        let rows = (tables[table] ?? []).filter((row) => filters.every(({ field, value, operation }) => {
          if (operation === "neq") return row[field] !== value;
          if (operation === "gt") return row[field] > (value as string);
          if (operation === "gte") return row[field] >= (value as string);
          if (operation === "in") return (value as unknown[]).includes(row[field]);
          return row[field] === value;
        }));
        if (orderField) rows = [...rows].sort((a, b) => String(a[orderField]).localeCompare(String(b[orderField])) * (ascending ? 1 : -1));
        rows = rows.slice(0, limit);
        if (values) { updates.push({ table, values }); rows.forEach((row) => Object.assign(row, values)); }
        return Promise.resolve(resolve({ data: single ? rows[0] ?? null : rows, error: null, count: count ? rows.length : null }));
      },
    };
    return query;
  };
  return { from, updates, tables };
}
