import {Registry} from './core/Registry';
import {Interpreter} from './core/Interpreter';
import {BaseUiComponent} from './components/BaseUiComponent';

const GenerativeUI = {
    /**
     * Creates and returns a new instance of the ComponentRegistry.
     * This is the primary interface for managing and rendering dynamic UI payloads.
     */
    create(): Registry {
        const registry = new Registry();
        const interpreter = new Interpreter(registry);

        // Step 2: Link them together, breaking the circular dependency.
        registry.setInterpreter(interpreter);

        // Step 3: Inject the singleton registry into the base component class.
        // This makes it available to all UI components.
        BaseUiComponent.setRegistry(registry);

        // Step 4: Store the registry as the singleton instance.
        return registry;
    }
};

export default GenerativeUI;
