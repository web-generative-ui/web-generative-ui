# Contributing to Web Generative UI

Thank you for your interest in contributing to **Web Generative UI**! This library aims to revolutionize web applications by enabling dynamic,
AI-driven user interfaces. We welcome contributions from the community to help improve the library, fix bugs, add features, or enhance documentation.
This guide outlines how you can contribute effectively.

## How to Contribute

### 1. Reporting Issues
If you find a bug, have a feature request, or want to suggest an improvement:
- Check the [GitHub Issues](https://github.com/Piplip/web-generative-ui/issues) page to see if your issue already exists.
- If it doesn't, create a new issue with a clear title and description.
- Include relevant details such as:
    - Steps to reproduce the issue (if applicable).
    - Expected behavior vs. actual behavior.
    - Your environment (e.g., Node.js version, browser, OS).
    - Code snippets or screenshots, if relevant.

### 2. Submitting Pull Requests
We use pull requests (PRs) to manage code contributions. To submit a PR:
1. **Fork the Repository**: Fork [web-generative-ui](https://github.com/Piplip/web-generative-ui) to your GitHub account.
2. **Clone Your Fork**:
   ```bash
   git clone https://github.com/Piplip/web-generative-ui.git
   cd web-generative-ui
   ```
3. **Create a Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   Use descriptive branch names (e.g., `fix/bug-description`, `feature/new-component`).
4. **Make Changes**:
    - Follow the [Coding Standards](#coding-standards) below.
    - Ensure your changes align with the project's goals (e.g., enhancing AI-driven UI capabilities).
5. **Test Your Changes**:
    - Currently, there are no automated tests. We will add them in the future. We only have a local Express server to test the UI components (in the backend folder).
6. **Commit Changes**:
    - Write clear, concise commit messages (e.g., `Add support for dynamic chat component`).
    - Use the present tense and be descriptive.
7. **Push to Your Fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Open a Pull Request**:
    - Go to the [web-generative-ui repository](https://github.com/Piplip/web-generative-ui) and create a PR from your branch.
    - Provide a detailed description of your changes, referencing any related issues (e.g., `Fixes #123`).
    - Ensure your PR passes CI checks (if applicable).

### 3. Suggesting Features
We love new ideas! To propose a feature:
- Open an issue with the label `enhancement`.
- Describe the feature, its use case, and how it aligns with Web Generative UI’s vision of AI-driven, dynamic interfaces.
- Be open to feedback and discussion from the community.

## Coding Standards
To maintain consistency and quality, please adhere to the following guidelines:
- **JavaScript/TypeScript**:
    - Use ES6+ syntax for modern JavaScript.
    - If using TypeScript, ensure strict type checking (`tsconfig.json` is configured with `strict: true`).
    - Follow [ESLint](https://eslint.org) rules defined in `.eslintrc.json`.
    - Format code with [Prettier](https://prettier.io) using the project’s `.prettierrc` settings.
- **Code Style**:
    - Use meaningful variable and function names (e.g., `createDynamicComponent` instead of `makeComp`).
    - Write modular, reusable code for components and utilities.
    - Avoid hardcoding values; use configuration objects or constants.
- **Documentation**:
    - Include JSDoc comments for public APIs and complex functions.
- **Testing**:
    - Write unit tests using [Jest](https://jestjs.io) for new features or bug fixes.
    - Ensure test coverage remains high (aim for >80% coverage).
    - Test across major browsers (Chrome, Firefox, Safari) for UI components.
- **AI Integration**:
    - Ensure compatibility with the Model Context Protocol (MCP) for AI-driven features.
    - Avoid hardcoding specific AI model dependencies; use abstraction layers.

## Development Setup
To set up the project locally:
You will need [Node.js](https://nodejs.org/en/), [npm](https://www.npmjs.com/) and [npx](https://www.npmjs.com/package/npx) installed on your machine.
NodeJS LTS versions are recommended.
1. **Clone and Install**:
   ```bash
   git clone https://github.com/Piplip/web-generative-ui.git
   cd web-generative-ui
   npm install
   ```
   
2. **Run Locally**:
   ```bash
   npm run dev
   ```
   
3. **Run mock backend server**:
   ```bash
   cd backend
   npm install
   npm start
   ```
   
   This starts a development server for testing UI components.

## Code Review Process
- All PRs are reviewed by at least one maintainer.
- Expect feedback within 3-5 days. Address comments promptly to keep the process smooth.
- PRs must pass CI checks (linting, tests, build) before merging.
- Ensure your changes don’t introduce breaking changes unless discussed and approved.

## Community Guidelines
We strive to create a welcoming and inclusive community. Please:
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md).
- Be respectful and constructive in discussions.

## Getting Help
- **Issues**: Search or ask questions on [GitHub Issues](https://github.com/Piplip/web-generative-ui/issue).

## Acknowledgments
Thank you for contributing to Web Generative UI! Your efforts help us build a more dynamic, AI-driven web.
Special thanks to all contributors and the open-source community for inspiring this project.
