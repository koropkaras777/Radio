import { JsonStore } from '../shared/jsonStore.js';
import { DEFAULT_DONATION_SETTINGS, sanitizeDonationSettings } from '../../../../donations/donationSettingsSchema.js';

export class DonationSettingsDomain {
  #store;

  constructor(filePath) {
    this.#store = new JsonStore(filePath, DEFAULT_DONATION_SETTINGS);
  }

  async loadDonationSettings() {
    const raw = await this.#store.read();
    return sanitizeDonationSettings(raw, DEFAULT_DONATION_SETTINGS);
  }

  async saveDonationSettings(settings) {
    const current = await this.loadDonationSettings();
    const sanitized = sanitizeDonationSettings(settings, current);
    await this.#store.update(() => ({ value: sanitized, result: undefined }));
    return sanitized;
  }
}
