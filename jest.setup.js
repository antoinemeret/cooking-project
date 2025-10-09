import '@testing-library/jest-dom'

// Polyfill for Node.js Web APIs needed for API route testing
import { TextEncoder, TextDecoder } from 'util'

// Add Web APIs polyfills for server-side API testing
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder
}

// Polyfill URL if not available
if (typeof global.URL === 'undefined') {
  const { URL, URLSearchParams } = require('url')
  global.URL = URL
  global.URLSearchParams = URLSearchParams
}

// Polyfill Request and Response for API route testing
if (typeof global.Request === 'undefined') {
  const { Request, Response } = require('node-fetch')
  global.Request = Request
  global.Response = Response
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  
  disconnect() {}
  
  observe() {}
  
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this.cb = cb
  }
  
  observe() {}
  
  disconnect() {}
  
  unobserve() {}
}

// Mock matchMedia (only in browser/jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
} 