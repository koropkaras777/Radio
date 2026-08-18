import { MEDIA_STORAGE } from '../../config/env.js';
import { LocalFileProvider } from './local/localFileProvider.js';
import { CloudProvider }     from './cloud/cloudProvider.js';

/**
 * @param {object} options
 * @param {string} options.musicPath
 * @param {string} options.artsPath
 */
export function createMediaProvider(options = {}) {
  switch (MEDIA_STORAGE) {
    case 'cloud':
      return new CloudProvider(options);
    case 'local':
    default:
      return new LocalFileProvider(options);
  }
}