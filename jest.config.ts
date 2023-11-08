import type { Config } from 'jest';

const config: Config = {
  transform: {
    '\\.(js|ts)$': 'ts-jest'
  },
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\.js$': '$1'
  }
};

export default config;
