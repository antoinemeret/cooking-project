# Admin Component Tests

This directory contains unit tests for the admin comparison interface components.

## Test Setup Required

To run these tests, you'll need to install the testing dependencies:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @types/jest jest jest-environment-jsdom
```

## Test Configuration

Create a `jest.config.js` file in the project root:

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
```

Create a `jest.setup.js` file in the project root:

```javascript
import '@testing-library/jest-dom'
```

## Test Coverage

The `ImportComparisonInterface.test.tsx` file covers:

- ✅ Initial component render and form validation
- ✅ Form interactions and state management
- ✅ API integration and loading states
- ✅ Successful results display and formatting
- ✅ Error handling and recovery
- ✅ Reset functionality
- ✅ Accessibility features

## Running Tests

Once setup is complete, run tests with:

```bash
npm test
```

Or with coverage:

```bash
npm run test:coverage
``` 