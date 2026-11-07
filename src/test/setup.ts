import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Reset the DOM and the storage between tests so project state never leaks.
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});
