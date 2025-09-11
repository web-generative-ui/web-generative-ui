import type {Children} from "../schema.ts";
import type {LayoutMeta} from "../schema.ts";

/**
 * Normalizes and extracts an array of child components from various potential fields
 * within a component's schema object. It checks for children in a specific order:
 * `componentSchema.children` (if an array), `componentSchema.children.items` (if an array),
 * `componentSchema.items` (if an array), and finally `componentSchema.content` (if an array).
 * This handles common variations in how child components might be structured in the schema.
 *
 * @param componentSchema The component schema object to inspect for child components.
 * @returns An array of `Children` (components) if found in any of the expected fields, otherwise `undefined`.
 */
export function normalizeChildrenField(componentSchema: any): Children | undefined {
    if (!componentSchema) return undefined;
    if (Array.isArray(componentSchema.children)) return componentSchema.children as Children;
    if (Array.isArray(componentSchema.children?.items)) return componentSchema.children.items as Children;
    if (Array.isArray(componentSchema.items)) return componentSchema.items as Children;
    if (Array.isArray(componentSchema.content)) return componentSchema.content as Children;

    return undefined;
}

/**
 * Applies layout-related CSS properties to a given HTML element based on provided `LayoutMeta`.
 * This function supports common flexbox and grid properties, enabling dynamic control
 * over element positioning and sizing within its parent container.
 *
 * Special handling for `span`:
 * - If `span` is a number, it's interpreted as `flex-grow` in a flex context.
 * - If `span` is a string (e.g., a CSS grid-column value), it's applied as `flex-basis`,
 *   allowing the parent container (grid or flex) to interpret it accordingly.
 *
 * @param element The HTMLElement to which layout metadata should be applied.
 * @param layout The `LayoutMeta` object containing CSS-like layout properties.
 * @returns `void`
 */
export function applyLayoutMeta(element: HTMLElement, layout?: LayoutMeta): void {
    if (!layout) return;

    const {span, order, align, grow, basis, area} = layout;

    if (order !== undefined) {
        element.style.order = String(order);
    }
    if (align) {
        element.style.alignSelf = align;
    }
    if (grow !== undefined) {
        element.style.flexGrow = String(grow);
    }
    if (basis) {
        element.style.flexBasis = basis;
    }
    if (span !== undefined) {
        if (typeof span === "number") {
            // In flex context, interpret numeric span as flex-grow
            element.style.flex = `${span} 1 0`;
        } else {
            // CSS string, let the container decide (grid-column, width, etc.)
            element.style.flexBasis = span;
        }
    }
    if (area) {
        element.style.gridArea = area;
    }
}

/**
 * Escapes HTML special characters in a string to prevent Cross-Site Scripting (XSS) vulnerabilities
 * when rendering user-provided or untrusted text content directly into HTML.
 * It replaces '&', '<', '>', '"', and "'" with their corresponding HTML entities.
 *
 * @param rawString The string containing potentially unsafe HTML characters.
 * @returns The HTML-escaped string.
 */
export function escapeHtml(rawString: string): string {
    const replacements: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return rawString.replace(/[&<>"']/g, char => replacements[char]);
}
