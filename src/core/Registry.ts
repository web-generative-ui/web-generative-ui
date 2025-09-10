import { Interpreter } from './Interpreter';
import { componentTagMap } from './ComponentMapping.ts';
import type {Children, Component, ElementModule} from '../schema.ts';
import {normalizeChildrenField} from "./common.ts";

/**
 * The Registry class manages the dynamic loading and definition of UI components.
 * It is responsible for ensuring that all components required by a given UI payload are loaded and defined.
 * This is the central component for managing and rendering dynamic UI payloads.
 */
export class Registry {
    private loadedComponents = new Set<string>();
    private interpreter!: Interpreter

    // A map from a schema component name to a function that dynamically imports its module
    private componentLoaders: { [schemaName: string]: () => Promise<ElementModule> } = {
        'card': () => import('../components/UiCard').then(mod => ({ default: mod.UiCard })),
        'text': () => import('../components/UiText').then(mod => ({ default: mod.UiText })),
        'loading': () => import('../components/UiLoading').then(mod => ({ default: mod.UiLoading })),
        'box': () => import('../components/UiBox').then(mod => ({ default: mod.UiBox })),
        'button': () => import('../components/UiButton').then(mod => ({ default: mod.UiButton })),
        'image': () => import('../components/UiImage').then(mod => ({ default: mod.UiImage })),
        'grid': () => import('../components/UiGrid').then(mod => ({ default: mod.UiGrid })),
        'spacer': () => import('../components/UiSpacer').then(mod => ({ default: mod.UiSpacer })),
        'divider': () => import('../components/UiDivider').then(mod => ({ default: mod.UiDivider })),
        'progress': () => import('../components/UiProgress').then(mod => ({ default: mod.UiProgress })),
        'badge': () => import('../components/UiBadge').then(mod => ({ default: mod.UiBadge })),
        'icon': () => import('../components/UiIcon').then(mod => ({ default: mod.UiIcon })),
        'link': () => import('../components/UiLink').then(mod => ({ default: mod.UiLink })),
        'video': () => import('../components/UiVideo').then(mod => ({ default: mod.UiVideo })),
        'tabs': () => import('../components/UiTabs').then(mod => ({ default: mod.UiTabs })),
        'collapse-block': () => import('../components/UiCollapseBlock').then(mod => ({ default: mod.UiCollapseBlock })),
        'carousel': () => import('../components/UiCarousel').then(mod => ({ default: mod.UiCarousel })),
        'reference': () => import('../components/UiReference').then(mod => ({ default: mod.UiReference })),
        'timeline': () => import('../components/UiTimeline').then(mod => ({ default: mod.UiTimeline })),
        'stream': () => import('../components/UiStream').then(mod => ({ default: mod.UiStream })),
        'table': () => import('../components/UiTable').then(mod => ({ default: mod.UiTable })),
        'error': () => import('../components/UiError').then(mod => ({ default: mod.UiError })),
        'history': () => import('../components/UiHistoryList.ts').then(mod => ({ default: mod.UiHistoryList })),
    };

    constructor() {}

    /**
     * Set the interpreter instance.
     * @param interpreter The Interpreter instance.
     */
    public setInterpreter(interpreter: Interpreter): void {
        this.interpreter = interpreter;
    }

    /**
     * Get the interpreter instance.
     * @returns The Interpreter instance.
     */
    public getInterpreter(): Interpreter {
        return this.interpreter;
    }

    /**
     * Ensures a component is loaded and defined.
     * @param schemaName The 'component' string from the schema (e.g., 'card', 'text').
     * @returns A promise that resolves when the component is defined.
     */
    public async ensureComponentDefined(schemaName: string): Promise<void> {
        const tagName = componentTagMap[schemaName];

        if (!tagName) {
            console.error(`Error: No tag mapping for schema component '${schemaName}'.`);
            return;
        }

        if (customElements.get(tagName) || this.loadedComponents.has(tagName)) {
            return;
        }

        const loader = this.componentLoaders[schemaName];
        if (!loader) {
            console.error(`Error: No dynamic loader found for schema component '${schemaName}'.`);
            return;
        }

        try {
            console.log(`Loading and defining component: ${schemaName} (${tagName})`);
            const module = await loader();
            const ComponentClass = module.default;

            if (ComponentClass && customElements.get(tagName) === undefined) {
                if (typeof ComponentClass === 'function' && ComponentClass.prototype instanceof HTMLElement) {
                    customElements.define(tagName, ComponentClass);
                    this.loadedComponents.add(tagName);
                } else {
                    console.error(`Error: Loaded module for '${schemaName}' does not export a valid HTMLElement subclass.`);
                }
            }
        } catch (error) {
            console.error(`Failed to load or define component '${schemaName}':`, error);
        }
    }

    /**
     * Preloads and defines all components (optional, for specific use cases).
     */
    public async preloadAllComponents(): Promise<void> {
        console.log("Preloading all known components...");
        const promises = Object.keys(this.componentLoaders).map(schemaName =>
            this.ensureComponentDefined(schemaName)
        );
        await Promise.all(promises);
        console.log("All components preloaded.");
    }

    /**
     * Ensures all components required by a given UI payload are loaded and defined.
     * This is the entry point for dynamic loading based on an LLM response.
     * @param payload A single Component or an array of Components.
     */
    public async ensurePayloadComponentsDefined(payload: Component | Children): Promise<void> {
        const MAX_DEPTH = 10; // Adjust based on your needs
        const componentsToCheck = Array.isArray(payload) ? payload : [payload];
        const schemaNamesToLoad = new Set<string>();
        const stack: { comp: Component; depth: number }[] = [];

        // Initialize stack with top-level components
        for (const comp of componentsToCheck) {
            if (comp) {
                stack.push({ comp, depth: 0 });
            }
        }

        while (stack.length > 0) {
            const { comp, depth } = stack.pop()!;

            // Add current component's schema name
            if (comp && comp.component) {
                schemaNamesToLoad.add(comp.component);
            }

            // Skip processing children if max depth reached
            if (depth >= MAX_DEPTH) {
                continue;
            }

            // Helper to push child components to stack
            const pushChildren = (children: Component[] | undefined) => {
                if (children && children.length > 0) {
                    for (const child of children) {
                        if (child) {
                            stack.push({ comp: child, depth: depth + 1 });
                        }
                    }
                }
            };

            // Check all possible child component sources
            const childrenArr = normalizeChildrenField(comp as any);
            if (Array.isArray(childrenArr)) {
                pushChildren(childrenArr);
            }

            // Tabs
            if ('tabs' in comp && Array.isArray((comp as any).tabs)) {
                for (const tab of (comp as any).tabs) {
                    if (Array.isArray(tab.content) && tab.content.length > 0) {
                        pushChildren(tab.content);
                    }
                }
            }

            // Stream items
            if ('items' in comp && Array.isArray((comp as any).items)) {
                for (const item of (comp as any).items) {
                    if (item && typeof item.component === 'string') {
                        pushChildren([item]);
                    }

                    const itemContent = (item as any).content;
                    if (itemContent && typeof itemContent === 'object') {
                        if (Array.isArray(itemContent)) {
                            pushChildren(itemContent);
                        } else if (typeof (itemContent as any).component === 'string') {
                            pushChildren([itemContent as Component]);
                        }
                    }
                }
            }

            // Content array
            if ('content' in comp && Array.isArray((comp as any).content)) {
                pushChildren((comp as any).content);
            }

            // Carousel
            if (('carousel' in comp) || comp.component === 'carousel') {
                const items = (comp as any).items;
                if (Array.isArray(items)) {
                    pushChildren(items);
                }
            }

            // Grid children
            if (comp && (comp as any).children && Array.isArray((comp as any).children)) {
                pushChildren((comp as any).children);
            }

            // Legacy table children
            if ('children' in comp) {
                const maybe = (comp as any).children;
                if (maybe && Array.isArray(maybe.items)) {
                    pushChildren(maybe.items);
                }
            }
        }

        // Batch process all schema definitions
        const definitionPromises = Array.from(schemaNamesToLoad).map(schemaName =>
            this.ensureComponentDefined(schemaName)
        );
        await Promise.all(definitionPromises);
    }
}
