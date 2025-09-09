import type {Children} from "../schema.ts";

export function normalizeChildrenField(comp: any): Children | undefined {
    // comp may have children, content, items, children?.items, etc.
    if (!comp) return undefined;
    if (Array.isArray(comp.children)) return comp.children as Children;
    if (Array.isArray(comp.children?.items)) return comp.children.items as Children;
    if (Array.isArray(comp.items)) return comp.items as Children;
    if (Array.isArray(comp.content)) return comp.content as Children;
    // nothing to normalize
    return undefined;
}

import type { LayoutMeta } from "../schema.ts";

/**
 * Apply layout metadata to a container element (usually a wrapper around a child).
 * Works for flex/grid containers.
 */
export function applyLayoutMeta(el: HTMLElement, layout?: LayoutMeta): void {
    if (!layout) return;

    const { span, order, align, grow, basis, area } = layout;

    if (order !== undefined) {
        el.style.order = String(order);
    }
    if (align) {
        el.style.alignSelf = align;
    }
    if (grow !== undefined) {
        el.style.flexGrow = String(grow);
    }
    if (basis) {
        el.style.flexBasis = basis;
    }
    if (span !== undefined) {
        if (typeof span === "number") {
            // In flex context, interpret numeric span as flex-grow
            el.style.flex = `${span} 1 0`;
        } else {
            // CSS string, let the container decide (grid-column, width, etc.)
            el.style.flexBasis = span;
        }
    }
    if (area) {
        el.style.gridArea = area;
    }
}

export function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
