import { Interpreter } from './Interpreter';
import { componentTagMap } from './ComponentMapping.ts';
import type {Children, Component, ElementModule} from '../schema.ts';

/**
 * The Registry class manages the dynamic loading and definition of UI components.
 * It is responsible for ensuring that all components required by a given UI payload are loaded and defined.
 * This is the central component for managing and rendering dynamic UI payloads.
 */
export class Registry {
    private loadedComponents = new Set<string>();
    private interpreter!: Interpreter

    // A map from a schema component name (e.g., "card") to a function that dynamically imports its module
    private componentLoaders: { [schemaName: string]: () => Promise<ElementModule> } = {
        'card': () => import('../components/UiCard').then(mod => ({ default: mod.UiCard })),
        'text': () => import('../components/UiText').then(mod => ({ default: mod.UiText })),
        'loading': () => import('../components/UiLoading').then(mod => ({ default: mod.UiLoading })),
        'box': () => import('../components/UiBox').then(mod => ({ default: mod.UiBox })),
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
        const componentsToCheck = Array.isArray(payload) ? payload : [payload];
        const schemaNamesToLoad = new Set<string>();

        // Recursively find all unique component names in the payload
        const findComponentNames = (comps: Component | Children | undefined) => {
            if (!comps) return;
            const currentComps = Array.isArray(comps) ? comps : [comps];
            currentComps.forEach(comp => {
                schemaNamesToLoad.add(comp.component);

                // Check for nested children
                if ('children' in comp && comp.children && comp.children.items) {
                    findComponentNames(comp.children.items);
                }
                // Special handling for components with non-standard 'children' properties
                if ('tabs' in comp && comp.tabs) {
                    comp.tabs.forEach(tab => findComponentNames(tab.content));
                }
                if ('content' in comp && (comp as any).content && Array.isArray((comp as any).content)) {
                    // This handles CollapseBlock.content and Tooltip.trigger
                    findComponentNames((comp as any).content);
                }
            });
        };

        findComponentNames(componentsToCheck);

        const definitionPromises = Array.from(schemaNamesToLoad).map(schemaName =>
            this.ensureComponentDefined(schemaName)
        );
        await Promise.all(definitionPromises);
    }
}
