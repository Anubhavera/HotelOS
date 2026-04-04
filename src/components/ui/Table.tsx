import styles from "./Table.module.css";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Column {
  key: string;
  header: string;
  render?: (item: any) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface TableProps {
  columns: Column[];
  data: any[];
  emptyMessage?: string;
  emptyIcon?: string;
  striped?: boolean;
  onRowClick?: (item: any) => void;
}

export function Table({
  columns,
  data,
  emptyMessage = "No data found",
  emptyIcon = "📋",
  striped = false,
  onRowClick,
}: TableProps) {
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
