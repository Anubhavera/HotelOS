import styles from "./Table.module.css";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  emptyIcon?: string;
  striped?: boolean;
  onRowClick?: (item: T) => void;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = "No data found",
  emptyIcon = "📋",
  striped = false,
  onRowClick,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={styles["table-container"]}>
        <div className={styles.table__empty}>
          <div className={styles["table__empty-icon"]}>{emptyIcon}</div>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["table-container"]}>
      <table
        className={`${styles.table} ${striped ? styles["table--striped"] : ""}`}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.align || "left" }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={(item.id as string) || idx}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ textAlign: col.align || "left" }}>
                  {col.render
                    ? col.render(item)
                    : (item[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
