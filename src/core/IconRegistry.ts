/**
 * `IconRegistry` is a static utility class that serves as a central repository for SVG icons.
 * It allows for the registration and retrieval of icons by name and variant (e.g., 'filled', 'outlined').
 * This registry ensures that UI components can consistently access and render SVG icons across the application.
 */
export class IconRegistry {
    /**
     * A static map storing SVG icon content, indexed first by icon name, then by variant.
     * @private
     */
    private static icons: Record<string, Record<string, string>> = {
        check: {
            filled: `<svg viewBox="0 0 24 24"><path d="M9 16.17l-3.88-3.88-1.42 1.41L9 19l12-12-1.41-1.41z"/></svg>`,
            outlined: `<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M9 16.17l-3.88-3.88-1.42 1.41L9 19l12-12-1.41-1.41z"/></svg>`
        },
        close: {
            filled: `<svg viewBox="0 0 24 24"><path d="M18.3 5.71L12 12l6.3 6.29-1.41 1.41L12 13.41 5.71 19.7 4.3 18.29 10.59 12 4.3 5.71 5.71 4.3 12 10.59l6.29-6.3z"/></svg>`,
        },
        warning: {
            filled: `<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-8h-2v6h2v-6z"/></svg>`
        },
        info: {
            filled: `<svg viewBox="0 0 24 24"><path d="M11 17h2v-6h-2v6zm0-8h2V7h-2v2zm1-7C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`
        },
        chevron_left: {
            filled: `<svg viewBox="0 0 24 24"><path d="M15.41 7.41L10.83 12l4.58 4.59L14 18l-6-6 6-6z"/></svg>`
        },
        chevron_right: {
            filled: `<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`
        },
        arrow_upward: {
            filled: `<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.59 5.58L20 12l-8-8-8 8z"/></svg>`
        },
        arrow_downward: {
            filled: `<svg viewBox="0 0 24 24"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.59-5.58L4 12l8 8 8-8z"/></svg>`
        },
        search: {
            filled: `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`
        },
        settings: {
            filled: `<svg viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.09-.7-1.71-.9L14 2h-4l-.28 2.81c-.6.2-1.16.49-1.7.9L5.9 4.23c-.22-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.64-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.09.7 1.71.9L10 22h4l.28-2.81c.6-.2 1.16-.49 1.7-.9l2.49 1c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-7.43 3.02c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>`
        },
        add: {
            filled: `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`
        },
        remove: {
            filled: `<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>`
        },
        edit: {
            filled: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`
        },
        delete: {
            filled: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.88l2.12-2.12 1.41 1.41L13.41 14.3l2.12 2.12-1.41 1.41L12 15.7l-2.12 2.12-1.41-1.41L10.59 14.3 8.46 12.18zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
        },
        send: {
            filled: `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`
        },
        history: {
            filled: `<svg viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.51 0-2.91-.49-4.08-1.3l-1.42 1.42C8.83 20.24 10.86 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v6l5.25 3.15.75-1.23-4.5-2.67V8h-1z"/></svg>`
        },
        expand_more: {
            filled: `<svg viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>`
        },
        expand_less: {
            filled: `<svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>`
        },
        error: {
            filled: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`
        }
    };

    /**
     * Retrieves the SVG content for a given icon name and variant.
     * If the specific variant is not found, it falls back to a generic filled variant.
     * If the icon name itself is not found, it returns an empty string or a fallback indicator.
     * @param name The name of the icon (e.g., 'check', 'chevron_left').
     * @param variant The desired variant of the icon ('filled', 'outlined', etc.). Defaults to 'filled'.
     * @returns The SVG content as a string, or a fallback string if the icon is not found.
     */
    static getIcon(name: string, variant: string = "filled"): string {
        return this.icons[name]?.[variant]
            || this.icons[name]?.['filled']
            || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2zm.0001-3c-4.9706 0-9 4.0294-9 9s4.0294 9 9 9 9-4.0294 9-9-4.0294-9-9-9zm0 16c-3.866 0-7-3.134-7-7s3.134-7 7-7 7 3.134 7 7-3.134 7-7 7z"/></svg>`; // Fallback to a generic error icon
    }

    /**
     * Registers a new SVG icon or a new variant for an existing icon.
     * @param name The name of the icon to register.
     * @param variant The variant of the icon (e.g., 'filled', 'outlined').
     * @param svg The SVG content as a string.
     */
    static registerIcon(name: string, variant: string, svg: string): void {
        if (!this.icons[name]) {
            this.icons[name] = {};
        }
        this.icons[name][variant] = svg;
    }
}
