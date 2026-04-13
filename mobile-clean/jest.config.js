module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-safe-area-context|react-native-screens|zustand|@tanstack/react-query)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@native/(.*)$': '<rootDir>/src/native/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/index.{ts,tsx}'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
