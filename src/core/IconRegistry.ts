export class IconRegistry {
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
        }
    };

    static getIcon(name: string, variant: string = "filled"): string {
        return this.icons[name]?.[variant] || `<span>❓</span>`;
    }

    static registerIcon(name: string, variant: string, svg: string) {
        if (!this.icons[name]) this.icons[name] = {};
        this.icons[name][variant] = svg;
    }
}
