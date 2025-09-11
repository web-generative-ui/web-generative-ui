# Web Generative UI

A frontend library for creating dynamic, AI-driven web interfaces that adapt in real-time (primarily ideal for Model Context Protocol applications).

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Introduction

**Web Generative UI** is a frontend library designed to revolutionize web applications by enabling dynamic,
AI-driven user interfaces. The ideas come from the vast development of the **Model Context Protocol**, it allows developers to create web experiences
that adapt and generate content in real-time, offering unparalleled interactivity and personalization. Whether you're
building a highly interactive dashboard, a personalized e-commerce platform, or a next-generation web app, Web
Generative UI empowers you to create adaptive, intelligent, and engaging user experiences. And I believe that it's the future of web applications
(not just stop at web UI but rather all other platforms)!

## Features

- **Dynamic UI Rendering**: Render interfaces that adapt in real-time (AI nature).
- **LLM first approach**: Use AI to generate content instead of hard-coding it, especially for the MCP ecosystem.
- **AI-Driven Content**: Generate content based on user input.
- **Context Management**: Manage context for ongoing conversations.
- **Model Context Protocol Integration**: Seamlessly leverage AI models to generate personalized content.
- **Real-Time Adaptability**: Update UI components dynamically without reloading the page.
- **Transport Channel Support**: Currently supports SSE and WebSocket transport channels.
- **Developer-Friendly API**: Simple and intuitive APIs for integrating generative UI into existing web projects.
- **Cross-Platform Compatibility**: Using native Web Components -> works with modern frontend frameworks like React, Vue, and Angular.

## Next Goals
- [ ] Refine Component styling & theming to match the design system.
- [ ] Introduce more flexible layout mechanism
- [ ] Implement more components.
- [ ] Accessibility.
- [ ] Actions handler.
- [ ] Support for more transport channels.

## Usage Examples
### Example 1: Personalized Product Recommendations
Using SSE transport channel to send and receive messages:

```html
<button id="trigger">SEND MESSAGE</button>
<div id="container"></div>
```

```javascript
const ui = await GenerativeUI.init({
    container: '#container',
    transport: {
        type: 'sse',
        streamURL: 'http://localhost:3000/api/llm-stream',
        sendURL: 'http://localhost:3000/api/llm-message',
    },
})

const conversationId = await ui.createConversation();
const trigger = document.getElementById('trigger');
trigger?.addEventListener('click', async () => {
    await ui.sendMessage(conversationId, 'Hello there!');
});
```

### Example 2: Dynamic Chat Interface
Using WebSocket transport channel to send and receive messages:

```javascript
const ui = await GenerativeUI.init({
    container: '#container',
    transport: {
        type: 'websocket',
        url: 'ws://localhost:3000/ws',
    },
});

await ui.connect();

const conversationId = await ui.createConversation();
const trigger = document.getElementById('trigger');
trigger?.addEventListener('click', async () => {
    await ui.sendMessage(conversationId, 'Hello there!');
});

window.addEventListener('beforeunload', () => {
    ui.disconnect();
});
```

## Contributing
We welcome contributions to Web Generative UI! To get started:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature`).
3. Make your changes and commit them (`git commit -m 'Add your feature'`).
4. Push to your branch (`git push origin feature/your-feature`).
5. Open a pull request.

Please read our [Contributing Guidelines](CONTRIBUTING.md) for more details and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Community and Support
- **Issues**: Report bugs or request features on our [GitHub Issues](https://github.com/Piplip/web-generative-ui) page.

## Acknowledgments
- Inspired by the [Model Context Protocol](https://modelcontextprotocol.io/) technology 
