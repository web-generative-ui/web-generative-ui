import {Interpreter} from './Interpreter';
import {componentTagMap} from './ComponentMapping.ts';
import type {Children, Component, ElementModule} from '../schema.ts';
import {normalizeChildrenField} from "./common.ts";

/**
 * The Registry class manages the dynamic loading and definition of UI components.
 * It is responsible for ensuring that all components required by a given UI payload are loaded and defined.
 * This is the central component for managing and rendering dynamic UI payloads.
 */
export class Registry {
    /**
     * A set to track the names of components that have been successfully loaded and defined as custom elements.
     * @private
     */
    private loadedComponents = new Set<string>();
    private interpreter!: Interpreter

    /**
     * A map that associates schema component names with functions that dynamically import their respective modules.
     * The keys are schema component names (e.g., 'card', 'text'), and the values are asynchronous functions
     * that resolve to an object containing the default export of the component module.
     * @private
     */
    private componentImportMap: { [schemaName: string]: () => Promise<ElementModule> } = {
        'card': () => import('../components/UiCard').then(mod => ({default: mod.UiCard})),
        'text': () => import('../components/UiText').then(mod => ({default: mod.UiText})),
        'loading': () => import('../components/UiLoading').then(mod => ({default: mod.UiLoading})),
        'box': () => import('../components/UiBox').then(mod => ({default: mod.UiBox})),
        'button': () => import('../components/UiButton').then(mod => ({default: mod.UiButton})),
        'image': () => import('../components/UiImage').then(mod => ({default: mod.UiImage})),
        'grid': () => import('../components/UiGrid').then(mod => ({default: mod.UiGrid})),
        'spacer': () => import('../components/UiSpacer').then(mod => ({default: mod.UiSpacer})),
        'divider': () => import('../components/UiDivider').then(mod => ({default: mod.UiDivider})),
        'progress': () => import('../components/UiProgress').then(mod => ({default: mod.UiProgress})),
        'badge': () => import('../components/UiBadge').then(mod => ({default: mod.UiBadge})),
        'icon': () => import('../components/UiIcon').then(mod => ({default: mod.UiIcon})),
        'link': () => import('../components/UiLink').then(mod => ({default: mod.UiLink})),
        'video': () => import('../components/UiVideo').then(mod => ({default: mod.UiVideo})),
        'tabs': () => import('../components/UiTabs').then(mod => ({default: mod.UiTabs})),
        'collapse-block': () => import('../components/UiCollapseBlock').then(mod => ({default: mod.UiCollapseBlock})),
        'carousel': () => import('../components/UiCarousel').then(mod => ({default: mod.UiCarousel})),
        'reference': () => import('../components/UiReference').then(mod => ({default: mod.UiReference})),
        'timeline': () => import('../components/UiTimeline').then(mod => ({default: mod.UiTimeline})),
        'stream': () => import('../components/UiStream').then(mod => ({default: mod.UiStream})),
        'table': () => import('../components/UiTable').then(mod => ({default: mod.UiTable})),
        'error': () => import('../components/UiError').then(mod => ({default: mod.UiError})),
    };

    constructor() {
    }

    /**
     * Sets the component import map for the Registry.  This is a map that associates schema component names
     * with functions that dynamically import their respective modules.  The keys are schema component names
     * (e.g., 'card', 'text'), and the values are asynchronous functions that resolve to an object containing
     * the default export of the component module.
     * @param componentImportMap
     */
    public setComponentImportMap(componentImportMap: { [schemaName: string]: () => Promise<ElementModule> }): void {
        this.componentImportMap = componentImportMap;
    }

    /**
     * Sets the Interpreter instance for use within the Registry.  This allows the Registry
     * to interact with the interpreter, likely for things like data binding and event handling.
     * @param interpreter The Interpreter instance to set.
     */
    public setInterpreter(interpreter: Interpreter): void {
        this.interpreter = interpreter;
    }

    /**
     * Retrieves the currently assigned Interpreter instance.
     * @returns The Interpreter instance.
     */
    public getInterpreter(): Interpreter {
        return this.interpreter;
    }

    /**
     * Ensures that a UI component, specified by its schema name, is loaded and defined as a custom element in the browser.
     * It checks if the component is already defined or loaded. If not, it dynamically imports the component's module,
     * defines it as a custom element, and adds the component's tag name to the list of loaded components.
     * @param componentName The name of the component as specified in the schema (e.g., 'card', 'text').
     * @returns A promise that resolves when the component is defined, or rejects if an error occurs during loading or definition.
     */
    public async ensureComponentDefined(componentName: string): Promise<void> {
        const customElementName = componentTagMap[componentName];

        if (!customElementName) {
            console.error(`Error: No tag mapping for schema component '${componentName}'.`);
            return;
        }

        if (customElements.get(customElementName) || this.loadedComponents.has(customElementName)) {
            return;
        }

        const loader = this.componentImportMap[componentName];
        if (!loader) {
            console.error(`Error: No dynamic loader found for schema component '${componentName}'.`);
            return;
        }

        try {
            console.log(`Loading and defining component: ${componentName} (${customElementName})`);
            const componentModule = await loader();
            const ComponentClass = componentModule.default;

            if (ComponentClass && customElements.get(customElementName) === undefined) {
                if (typeof ComponentClass === 'function' && ComponentClass.prototype instanceof HTMLElement) {
                    customElements.define(customElementName, ComponentClass);
                    this.loadedComponents.add(customElementName);
                } else {
                    console.error(`Error: Loaded module for '${componentName}' does not export a valid HTMLElement subclass.`);
                }
            }
        } catch (error) {
            console.error(`Failed to load or define component '${componentName}':`, error);
        }
    }

    /**
     * Preloads and defines all known UI components.  This is an optional utility function
     * that can be used to pre-emptively load all components defined in `componentImportMap`.  This can
     * be useful to avoid loading delays at runtime, especially for applications that know
     * all available components ahead of time.
     *
     * Note: This should be used judiciously as it can increase initial load times.
     *
     * @returns A promise that resolves when all components have been preloaded.
     */
    public async preloadAllComponents(): Promise<void> {
        console.log("Preloading all known components...");
        const promises = Object.keys(this.componentImportMap).map(schemaName =>
            this.ensureComponentDefined(schemaName)
        );
        await Promise.all(promises);
        console.log("All components preloaded.");
    }

    /**
     * Ensures that all components required by a given UI payload (a single component or an array of components)
     * are loaded and defined as custom elements in the browser.  This method recursively traverses
     * the component structure to identify and load all dependent components. It is the
     * primary entry point for the dynamic loading of components based on a UI schema, typically generated by an LLM.
     *
     * @param payload The UI payload, which can be a single Component object or an array of Component objects (Children).
     * @throws {Error} If the component structure exceeds the maximum depth to avoid infinite loops.
     */
    public async ensurePayloadComponentsDefined(payload: Component | Children): Promise<void> {
        const MAX_COMPONENT_DEPTH = 10; // Adjust based on your needs
        const initialComponents = Array.isArray(payload) ? payload : [payload];
        const schemaNamesToLoad = new Set<string>();
        const stack: { comp: Component; depth: number }[] = [];

        // Initialize the stack with top-level components
        for (const comp of initialComponents) {
            if (comp) {
                stack.push({comp, depth: 0});
            }
        }

        while (stack.length > 0) {
            const {comp, depth} = stack.pop()!;

            // Add current component's schema name
            if (comp && comp.component) {
                schemaNamesToLoad.add(comp.component);
            }

            // Skip processing children if max depth reached
            if (depth >= MAX_COMPONENT_DEPTH) {
                continue;
            }

            // Helper to push child components to stack
            const enqueueChildren = (children: Component[] | undefined) => {
                if (children && children.length > 0) {
                    for (const child of children) {
                        if (child) {
                            stack.push({comp: child, depth: depth + 1});
                        }
                    }
                }
            };

            // Check all possible child component sources
            const normalizedChildren = normalizeChildrenField(comp as any);
            if (Array.isArray(normalizedChildren)) {
                enqueueChildren(normalizedChildren);
            }

            const enqueueChildrenFrom = (source: any) => {
                if (Array.isArray(source)) {
                    enqueueChildren(source);
                }
            };

            if ('tabs' in comp && Array.isArray((comp as any).tabs)) {
                (comp as any).tabs.forEach((tab: any) => enqueueChildrenFrom(tab.content));
            }

            if ('items' in comp && Array.isArray((comp as any).items)) {
                (comp as any).items.forEach((item: any) => {
                    if (item && typeof item.component === 'string') {
                        enqueueChildren([item]);
                    }
                    enqueueChildrenFrom((item as any).content);
                });
            }

            enqueueChildrenFrom((comp as any).content);


            if (('carousel' in comp) || comp.component === 'carousel') {
                enqueueChildrenFrom((comp as any).items);
            }

            if (comp && (comp as any).children) {
                enqueueChildrenFrom((comp as any).children);
            }

            // Legacy table children
            if ('children' in comp) {
                const maybe = (comp as any).children;
                enqueueChildrenFrom(maybe?.items);
            }
        }

        // Batch process all schema definitions
        const definitionPromises = Array.from(schemaNamesToLoad).map(schemaName =>
            this.ensureComponentDefined(schemaName)
        );
        await Promise.all(definitionPromises);
    }
}
