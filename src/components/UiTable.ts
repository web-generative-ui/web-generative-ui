import type {Table} from "../schema.d.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {applyLayoutMeta, escapeHtml} from "../core/common.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiTable` is a custom UI component that renders tabular data.
 * It displays data in rows and columns based on the provided `columns` definition and `data` array.
 * An optional `children` property can be used to render additional components in a footer row.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Table` object.
 *
 * @element ui-table
 * @slot (default) Renders child components passed in its `children` property as a footer row.
 */
export class UiTable extends BaseUiComponent {

    /**
     * The parsed data for the table component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private tableData: Table | null = null;

    /**
     * Constructs an instance of `UiTable`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Table` object.
     * Includes validation to ensure the `component` type is 'table' and required `columns` and `data` are present.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "table" || !Array.isArray(parsed.columns) || !Array.isArray(parsed.data)) {
                throw new Error("Invalid table component data: 'component' must be 'table', and 'columns'/'data' must be arrays.");
            }
            this.tableData = parsed as Table;
        } catch (e: unknown) {
            console.error("UiTable: Failed to parse data attribute:", e);
            this.tableData = null;
        }
    }

    /**
     * Indicates whether the `tableData` has been successfully parsed.
     * @protected
     * @returns `true` if `tableData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.tableData !== null;
    }

    /**
     * Renders the HTML content of the table component into its Shadow DOM.
     * It dynamically generates the table header and body rows based on `tableData`,
     * and optionally renders child components in a special footer row.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.tableData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Table data missing or invalid.</div>`;
            return;
        }

        const {columns = [], data = [], children = []} = this.tableData;
        const colCount = Math.max(1, columns.length); // Ensure colSpan is at least 1

        // Build header HTML, applying width and align styles if specified in columns schema
        const headerHtml = columns
            .map(col => `
                <th style="${col.width ? `width: ${col.width};` : ''} ${col.align ? `text-align: ${col.align};` : ''}">
                    ${escapeHtml(String(col.header ?? col.key))}
                </th>
            `)
            .join("");

        // Build body HTML, applying align styles to cells
        const bodyHtml = data
            .map(row => {
                const cells = columns
                    .map(col => `
                        <td style="${col.align ? `text-align: ${col.align};` : ''}">
                            ${escapeHtml(this.cellText(row[col.key]))}
                        </td>
                    `)
                    .join("");
                return `<tr>${cells}</tr>`;
            })
            .join("");

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block; /* Tables usually behave as block-level containers */
                    box-sizing: border-box;
                    width: 100%; /* Take full available width */
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 1em 0; /* Add some default margin */
                    overflow-x: auto; /* Allow horizontal scroll for narrow screens */
                    ${this.tableData.style ? formatInlineStyle(this.tableData.style) : ''}
                    ${this.tableData.layout ? formatLayoutMetaAsHostStyle(this.tableData.layout) : ''}
                    /* Base transitions for enter/exit */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9em; /* Slightly smaller font for dense data */
                    min-width: max-content; /* Prevent table from collapsing in narrow spaces */
                }
                thead {
                    background-color: #f8f8f8; /* Light header background */
                }
                th, td {
                    border: 1px solid #e0e0e0; /* Lighter, subtle border */
                    padding: 0.8em 1em; /* Increased padding */
                    text-align: left;
                }
                th {
                    font-weight: 600; /* Slightly bolder headers */
                    color: #333;
                }
                tbody tr:nth-child(even) {
                    background-color: #fcfcfc; /* Subtle zebra striping */
                }
                tbody tr:hover {
                    background-color: #f0f0f0; /* Hover effect for rows */
                }
                .children-row td {
                    background-color: #fff; /* White background for footer row */
                    padding: 0; /* No default padding, content container will manage */
                }
                .children-container {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem; /* Spacing between child components in the footer */
                    padding: 0.75em 1em; /* Internal padding for the children container */
                }
                .child-wrapper {
                    display: block; /* Children rendered as blocks by default */
                }
            </style>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>${headerHtml}</tr>
                    </thead>
                    <tbody>
                        ${bodyHtml}
                    </tbody>
                </table>
            </div>
        `;

        // Render children (if any) into a children-row appended after data rows
        if (Array.isArray(children) && children.length > 0) {
            const tbody = this.shadow.querySelector("tbody") as HTMLElement | null;
            if (tbody) {
                const childrenRow = document.createElement("tr");
                childrenRow.classList.add("children-row");

                const td = document.createElement("td");
                td.classList.add("children-cell");
                td.colSpan = colCount; // Span across all columns

                const container = document.createElement("div");
                container.classList.add("children-container");

                for (const child of children) {
                    if (!child) continue; // Skip null/undefined children for safety

                    const wrapper = document.createElement("div");
                    wrapper.classList.add("child-wrapper");

                    // Apply layout metadata (flex/grid hints) to wrapper
                    applyLayoutMeta(wrapper, child.layout);
                    if (child.style) { // Apply inline style from schema.d.ts
                        Object.assign(wrapper.style, child.style);
                    }

                    container.appendChild(wrapper);
                    // Render child component into its wrapper
                    this.registry.getInterpreter().render(wrapper, child);
                }

                td.appendChild(container);
                childrenRow.appendChild(td);
                tbody.appendChild(childrenRow);
            }
        }
    }

    /**
     * Helper function to convert an unknown value into a plain string for table cell display.
     * It handles `null`, `undefined`, and `object` types gracefully.
     * @private
     * @param value The value to convert.
     * @returns A string representation of the value.
     */
    private cellText(value: unknown): string {
        if (value === null || value === undefined) return "";
        if (typeof value === "object") {
            try {
                // Attempt to stringify objects for display. Handles circular references by catching.
                return JSON.stringify(value);
            } catch {
                return String(value); // Fallback to basic string conversion for complex objects
            }
        }
        return String(value);
    }
}
