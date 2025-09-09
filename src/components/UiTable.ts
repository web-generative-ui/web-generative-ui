import type { Table } from "../schema.ts";
import { BaseUiComponent } from "./BaseUiComponent.ts";
import {applyLayoutMeta, escapeHtml} from "../core/common.ts";

/**
 * UiTable - renders a simple table and an optional children row (children?: Children).
 * Uses columns[].header for column headers and data[] for rows.
 */
export class UiTable extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private tableData: Table | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(data: string): void {
        try {
            // permissive parsing; schema validation happens elsewhere if needed
            this.tableData = JSON.parse(data) as Table;
        } catch (e) {
            console.error("UiTable parseData error:", e);
            this.tableData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.tableData !== null;
    }

    protected renderContent(): void {
        if (!this.tableData) {
            this.shadow.innerHTML = `<span style="color:red;">Invalid or missing table data</span>`;
            return;
        }

        const { columns = [], data = [], children } = this.tableData;
        const colCount = Math.max(1, columns.length);

        // build header and body HTML safely
        const headerHtml = columns
            .map(col => `<th>${escapeHtml(String(col.header ?? col.key))}</th>`)
            .join("");

        const bodyHtml = data
            .map(row => {
                const cells = columns
                    .map(col => `<td>${escapeHtml(this.cellText(row[col.key]))}</td>`)
                    .join("");
                return `<tr>${cells}</tr>`;
            })
            .join("");

        this.shadow.innerHTML = `
            <style>
                :host { display: block; font-family: sans-serif; }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.95em;
                }
                thead { background: #f5f5f5; }
                th, td {
                    border: 1px solid #ddd;
                    padding: 0.5em 0.75em;
                    text-align: left;
                }
                tbody tr:nth-child(even) { background: #fafafa; }
                .children-row { background: #fff; }
                .children-cell { padding: 0.5em; }
                .children-container { display: flex; flex-direction: column; gap: 0.5rem; }
                .child-wrapper { display: block; }
            </style>

            <table>
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody>
                    ${bodyHtml}
                </tbody>
            </table>
        `;

        // Render children (if any) into a children-row appended after data rows
        if (Array.isArray(children) && children.length > 0) {
            const tbody = this.shadow.querySelector("tbody") as HTMLElement | null;
            if (tbody) {
                const childrenRow = document.createElement("tr");
                childrenRow.classList.add("children-row");

                const td = document.createElement("td");
                td.classList.add("children-cell");
                td.colSpan = colCount;

                const container = document.createElement("div");
                container.classList.add("children-container");

                for (const child of children) {
                    const wrapper = document.createElement("div");
                    wrapper.classList.add("child-wrapper");

                    // apply layout metadata (flex/grid hints) to wrapper
                    applyLayoutMeta(wrapper, (child as any).layout);

                    container.appendChild(wrapper);
                    // render child component into its wrapper
                    this.registry.getInterpreter().render(wrapper, child);
                }

                td.appendChild(container);
                childrenRow.appendChild(td);
                tbody.appendChild(childrenRow);
            }
        }
    }

    // Helper: produce a plain string for cell value
    private cellText(value: unknown): string {
        if (value === null || value === undefined) return "";
        if (typeof value === "object") {
            try { return JSON.stringify(value); } catch { return String(value); }
        }
        return String(value);
    }
}
