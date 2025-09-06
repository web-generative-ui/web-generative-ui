import './transition.css';
import GenerativeUI from './index';

GenerativeUI.start({
    container: '#app',
    transport: {
        type: 'sse',
        url: 'http://localhost:3000/api/llm-stream',
    },
});
