import { loadSettingsFile, saveSettingsFile, sanitizeSongGroups } from '../../../../engine/radioSettings.js';

export class SettingsDomain {
  #rootDir;

  constructor(rootDir) {
    this.#rootDir = rootDir;
  }

  #sortGroupDefs(groupDefs) {
    if (!groupDefs || typeof groupDefs !== 'object') return groupDefs;

    return Object.fromEntries(
      Object.keys(groupDefs).sort()
        .map((name) => [
          name,
          Array.isArray(groupDefs[name]) ? [...groupDefs[name]].sort() : groupDefs[name],
        ])
    );
  }

  async loadSettings(defaults) {
    const settings = await loadSettingsFile(this.#rootDir, defaults);
    const generation = settings?.generation;

    return {
      ...settings,
      ...(generation ? {
        generation: {
          ...generation,
          GROUP_DEFS: this.#sortGroupDefs(generation.GROUP_DEFS),
          NIGHT_GROUP_DEFS: this.#sortGroupDefs(generation.NIGHT_GROUP_DEFS),
        },
      } : {}),
      ...(Array.isArray(settings?.songGroups) ? {
        songGroups: [...settings.songGroups].sort((a, b) =>
          String(a?.name || '').localeCompare(String(b?.name || ''))),
      } : {}),
    };
  }

  async saveSettings(settings) {
    await saveSettingsFile(this.#rootDir, settings);
    return settings;
  }

  getSongGroupsFromSettings(settings) {
    return sanitizeSongGroups(settings?.songGroups, []);
  }
}
