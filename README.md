**Core Purpose:** To be an expert, real-time renderer for conversational AI outputs, translating a minimal, declarative JSON stream into a rich, animated, and interactive DOM representation.

**Key Architectural Pillars:**

1.  **Immutable, Streamed Rendering**: The library consumes a stream of `Patch` operations (`add`, `update`, `remove`). It treats the UI as a continuously evolving artifact of the AI's "thought process," not a static state to be managed.

2.  **Minimalist & Declarative Schema**: The set of components is designed for low token count and high expressiveness, focusing on information display and simple layout.
    *   **Content Components**: `Text`, `CodeBlock`, `Image`, `Table`, `Chart`, `Badge`, `Progress`, `Loading`.
    *   **Layout Components**: `Row`, `Column`, `Grid`, `Spacer`.
    *   **Actionable Components**: `Button`, `Link`, clickable `Card`s. These are the *only* bridge back to the application logic.

3.  **One-Way Data Flow (with an Action Egress)**:
    *   **(Downstream)**: LLM -> Backend -> **SSE Stream (`Patch` objects)** -> `Interpreter` -> DOM.
    *   **(Upstream / "Egress")**: User clicks an interactive element (e.g., `<ui-button>`) -> **`ui-action` Custom Event** -> Application logic -> Send new prompt to LLM.
    *   This is a closed loop, but our library is only responsible for the rendering part of the downstream and the event dispatch part of the upstream.

4.  **Dynamic Component Loading**: The `Registry` remains essential. As the LLM generates varied responses, the library must be able to lazy-load and define the required components on the fly without needing a massive upfront bundle.

5.  **Polished UX by Default**:
    *   **Transitions**: The built-in, non-destructive, and overridable transition system is a core feature, making the AI's streamed output feel fluid and intelligent rather than jarring.
    *   **Accessibility**: All provided components must be accessible out of the box.
