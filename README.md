
# @t8ngs/runner

> Test Eight Things – A simple, fast, and expressive test runner for Node.js

[![license](https://img.shields.io/npm/l/@t8ngs/runner?color=blueviolet&style=for-the-badge)](LICENSE.md)
[![typescript](https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript)](tsconfig.json)

**@t8ngs/runner** is a modern testing framework for Node.js, inspired by Japa, but with its own soul: _test eight things_. Designed for simplicity, speed, and extensibility, it helps you write and run tests for backend applications and libraries with zero bloat.

## Features

- ⚡️ Fast and minimal core
- 🧩 Plugin-based architecture
- 📝 Simple, expressive test syntax
- 🔥 TypeScript-first
- 🧪 Built for backend and library testing
- 🧭 Inspired by Japa, but with the t8ngs spirit

## Installation

```bash
npm install @t8ngs/runner --save-dev
```

## Usage

Create a test file, e.g. `example.spec.ts`:

```typescript
import { test } from '@t8ngs/runner'

test('math works', ({ assert }) => {
	assert.equal(2 + 2, 4)
})
```

Run your tests:

```bash
npx t8ngs-runner
```

## Philosophy

**t8ngs/runner** is about focus: test eight things, not everything. Keep your test suites lean, readable, and maintainable. The framework encourages you to group, organize, and run tests in a way that values clarity over quantity.

## Project Structure

- `src/` – Core source code and plugins
- `modules/core/` – Core test runner logic
- `factories/` – Utilities for test creation
- `examples/` – Example test files
- `tests/` – Test suite for the runner itself

## License

MIT – see [LICENSE.md](LICENSE)
