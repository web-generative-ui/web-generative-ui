import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Table} from "../schema.ts";

export class UiTable extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private tableData: Table | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "table" || !Array.isArray(parsed.data) || !Array.isArray(parsed.columns)) {
                throw new Error("Invalid table component data");
            }
            this.tableData = parsed;
            this.renderContent();
        } catch (e) {
            console.error("UiTable parseData error:", e);
            this.tableData = null;
            this.renderContent();
        }
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color:red;">Invalid or missing table data</span>`;
            return;
        }

        const { columns, data, children } = this.tableData!;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.95em;
                }
                thead {
                    background: #f5f5f5;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 0.5em 0.75em;
                    text-align: left;
                }
                th {
                    font-weight: bold;
                }
                tbody tr:nth-child(even) {
                    background: #fafafa;
                }
                .children-row {
                    background: #fff;
                }
                .children-cell {
                    padding: 0.5em;
                }
            </style>
            <table>
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col.header}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${data
            .map(
                row => `
                            <tr>
                                ${columns
                    .map(col => `<td>${row[col.key] !== undefined ? row[col.key] : ""}</td>`)
                    .join("")}
                            </tr>
                        `
            )
            .join("")}
                    ${
            children?.items
                ? `
                        <tr class="children-row">
                            <td class="children-cell" colspan="${columns.length}">
                                <div class="children-container"></div>
                            </td>
                        </tr>
                        `
                : ""
        }
                </tbody>
            </table>
        `;

        // Render children if any
        if (children?.items) {
            const container = this.shadow.querySelector(".children-container") as HTMLElement;
            if (container) {
                this.registry.getInterpreter().render(container, children.items);
            }
        }
    }

    protected hasParsedData(): boolean {
        return this.tableData !== null;
    }
}
