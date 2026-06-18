/**
 * Jest configuration.
 *
 * Tests target the pure, security-critical modules (redaction, access control,
 * PII masking, session timeout, audit). These have no React Native imports, so
 * the jest-expo preset transforms the TypeScript without needing a device
 * runtime. CI runs this WITHOUT --passWithNoTests so an empty suite fails.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    'src/domain/services/**/*.ts',
  ],
};
