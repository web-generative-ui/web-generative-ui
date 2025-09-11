import {describe, it, expect, beforeEach, vi} from 'vitest';
import {Registry} from "../../src/core/Registry";
import {Interpreter} from "../../src/core/Interpreter";
import type {Component} from "../../backend/schema";
import {componentTagMap} from "../../src/core/ComponentMapping";

// Mock the global `customElements` API
const customElementsDefineSpy = vi.spyOn(customElements, 'define');

// Mock component classes
class MockComponent extends HTMLElement {
}

describe('Registry', () => {
    let registry: Registry;
    const mockComponentMap = {
        'text': () => Promise.resolve({default: MockComponent}),
        'card': () => Promise.resolve({default: MockComponent}),
        'non-existent-comp': () => Promise.resolve({default: class Invalid {
            }} as any),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(customElements, 'get').mockReturnValue(undefined);

        registry = new Registry();
        // Directly assign the mock map to the private property for testing
        registry.setComponentImportMap(mockComponentMap);
        componentTagMap.text = 'ui-text';
        componentTagMap.card = 'ui-card';
    });

    it('should correctly set and get the interpreter instance', () => {
        const mockInterpreter = new Interpreter(registry);
        registry.setInterpreter(mockInterpreter);
        expect(registry.getInterpreter()).toBe(mockInterpreter);
    });

    it('should successfully load and define a new component', async () => {
        await registry.ensureComponentDefined('text');
        expect(customElementsDefineSpy).toHaveBeenCalledWith('ui-text', MockComponent);
        // @ts-ignore
        expect(registry.loadedComponents.has('ui-text')).toBe(true);
    });

    it('should not redefine an already loaded component', async () => {
        vi.spyOn(customElements, 'get').mockReturnValue(MockComponent as any);
        await registry.ensureComponentDefined('text');
        expect(customElementsDefineSpy).not.toHaveBeenCalled();
    });

    it('should handle payload with nested components from various fields', async () => {
        // Correctly define the payload object without type casting.
        // TypeScript can infer the correct type from the object literal.
        const payload: Component = {
            component: 'card',
            title: 'Test Card',
            children: [
                {component: 'text', text: 'Nested Text'},
                {component: 'box', children: [{component: 'button', label: 'Click me'}]}
            ],
            // @ts-ignore: The `tabs` property is specific to the `Tabs` component
            tabs: [{
                id: 'tab1',
                label: 'Tab',
                content: [{component: 'link', href: '#', children: [{component: 'text', text: 'Test Link'}]}]
            }],
        };
        // Mock dynamic loader for components not in the initial mock map
        // @ts-ignore
        registry.componentImportMap = {
            ...mockComponentMap,
            'box': () => Promise.resolve({default: MockComponent}),
            'button': () => Promise.resolve({default: MockComponent}),
            'link': () => Promise.resolve({default: MockComponent}),
        };
        // Mock tag map for new components
        // @ts-ignore
        componentTagMap.box = 'ui-box';
        // @ts-ignore
        componentTagMap.button = 'ui-button';
        // @ts-ignore
        componentTagMap.link = 'ui-link';

        await registry.ensurePayloadComponentsDefined(payload);
        const loadedComponents = Array.from(customElementsDefineSpy.mock.calls.map(c => c[0]));
        expect(loadedComponents).toEqual(expect.arrayContaining(['ui-card', 'ui-text', 'ui-box', 'ui-button', 'ui-link']));
    });
});
