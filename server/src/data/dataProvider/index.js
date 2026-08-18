import { DATA_PROVIDER } from '../../config/env.js';
import { JsonDataProvider } from './json/jsonDataProvider.js';
import { SqlDataProvider } from './sql/sqlDataProvider.js';

export function createDataProvider(options = {}) {
  switch (DATA_PROVIDER) {
    case 'sql':
      return new SqlDataProvider(options);
    case 'json':
    default:
      return new JsonDataProvider(options);
  }
}