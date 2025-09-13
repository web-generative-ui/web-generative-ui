import type {LayoutMeta} from "../schema.d.ts";

/**
 * Formats a style object into a CSS string for inline application.
 * @private
 * @param styleObj The style object.
 * @returns A CSS string.
 */
export function formatInlineStyle(styleObj: { [key: string]: string | number }): string {
    return Object.entries(styleObj)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
        .join(' ');
}

/**
 * Formats LayoutMeta properties into CSS style for host or container.
 * This is a simple interpretation; complex layout meta might need dedicated CSS rules.
 * @private
 * @param layoutMeta The LayoutMeta object.
 * @returns A CSS string.
 */
export function formatLayoutMetaAsHostStyle(layoutMeta: LayoutMeta): string {
    let style = '';
    if (layoutMeta.span !== undefined) {
        if (typeof layoutMeta.span === 'number') {
            style += `flex: ${layoutMeta.span} 1 0;`;
        } else {
            style += `width: ${layoutMeta.span};`;
        }
    }
    if (layoutMeta.grow !== undefined) style += `flex-grow: ${layoutMeta.grow};`;
    if (layoutMeta.basis) style += `flex-basis: ${layoutMeta.basis};`;
    if (layoutMeta.area) style += `grid-area: ${layoutMeta.area};`;
    if (layoutMeta.order !== undefined) style += `order: ${layoutMeta.order};`;
    if (layoutMeta.align) style += `align-self: ${layoutMeta.align};`;
    return style;
}
