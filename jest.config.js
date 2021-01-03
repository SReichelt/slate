module.exports = {
  roots: [
    '<rootDir>/src'
  ],
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/src/client/tsconfig.json'
    }
  },
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/src/client/__mocks__/empty.ts'
  }
};
