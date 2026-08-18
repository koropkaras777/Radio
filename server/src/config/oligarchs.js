import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR  = path.resolve(__dirname, '../i18n');
const DEFAULT_LOCALE = 'uk';

// ── Load per-locale `oligarchs.json` translation files ──────────────────────
const oligarchTranslations = {};
for (const entry of fs.readdirSync(I18N_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = path.join(I18N_DIR, entry.name, 'oligarchs.json');
  if (!fs.existsSync(file)) continue;
  try {
    oligarchTranslations[entry.name] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`[Oligarchs] Failed to parse ${file}:`, err.message);
  }
}

export const OLIGARCH_LOCALES = Object.keys(oligarchTranslations);

// ── Base registry (uk = source of truth / fallback if a locale is missing) ──
export const OLIGARCHS = [
  { key: 'akhmetov',    name: 'Рінат Ахметов',      img: 'akhmetov.png'    },
  { key: 'kolomoyskyi', name: 'Адмін Бєня',         img: 'kolomoyskyi.png' },
  { key: 'poroshenko',  name: 'Петро Порошенко',    img: 'poroshenko.png'  },
  { key: 'firtash',     name: 'Дмитро Фірташ',      img: 'firtash.png'     },
  { key: 'pinchuk',     name: 'Віктор Пінчук',      img: 'pinchuk.png'     },
  { key: 'novynskyi',   name: 'Вадим Новинський',   img: 'novynskyi.png'   },
  { key: 'taruta',      name: 'Сергій Тарута',      img: 'taruta.png'      },
  { key: 'boholyubov',  name: 'Геннадій Боголюбов', img: 'boholyubov.png'  },
  { key: 'lyovochkin',  name: 'Сергій Льовочкін',   img: 'lyovochkin.png'  },
  { key: 'surkis',      name: 'Григорій Суркіс',    img: 'surkis.png'      },
  { key: 'isurkis',     name: 'Ігор Суркіс',        img: 'isurkis.png'     },
  { key: 'zhevago',     name: 'Костянтин Жеваго',   img: 'zhevago.png'     },
  { key: 'bezos',       name: 'Джефф Безос',        img: 'bezos.png'       },
  { key: 'brin',        name: 'Сергій Брін',        img: 'brin.png'        },
  { key: 'durov',       name: 'Павло Дуров',        img: 'durov.png'       },
  { key: 'gates',       name: 'Білл Гейтс',         img: 'gates.png'       },
  { key: 'musk',        name: 'Ілон Маск',          img: 'musk.png'        },
  { key: 'nahyan',      name: 'шейх Мансур',        img: 'nahyan.png'      },
  { key: 'salman',      name: 'шейх Салман',        img: 'salman.png'      },
  { key: 'zuckerberg',  name: 'Марк Цукерберг',     img: 'zuckerberg.png'  },
  { key: 'ambani',      name: 'Мукеш Амбані',       img: 'ambani.png'      },
];

export const ADMIN_OLIGARCH   = { key: 'kolomoyskyi', name: 'Адмін Бєня', img: 'kolomoyskyi.png', isAdmin: true };
export const PUBLIC_OLIGARCHS = OLIGARCHS.filter((o) => o.key !== ADMIN_OLIGARCH.key);

// ── Localization helpers ─────────────────────────────────────────────────────
export function localizeOligarchName(key) {
  const fallbackUk = OLIGARCHS.find((o) => o.key === key)?.name || key;
  const localized  = {};
  for (const locale of OLIGARCH_LOCALES) {
    localized[locale] = oligarchTranslations[locale]?.[key]
      || oligarchTranslations[DEFAULT_LOCALE]?.[key]
      || fallbackUk;
  }
  if (!localized[DEFAULT_LOCALE]) localized[DEFAULT_LOCALE] = fallbackUk;
  return localized;
}

export function localizeAdminHelperName(oligarch) {
  const localized = {};
  for (const locale of OLIGARCH_LOCALES) {
    const fullName  = oligarchTranslations[locale]?.[oligarch.key] || oligarch.name;
    const surname    = fullName.trim().split(/\s+/).slice(-1)[0];
    const adminWord  = oligarchTranslations[locale]?._admin
      || (locale === DEFAULT_LOCALE ? 'Адмін' : 'Admin');
    localized[locale] = `${adminWord} ${surname}`;
  }
  if (!localized[DEFAULT_LOCALE]) {
    const surname = oligarch.name.trim().split(/\s+/).slice(-1)[0];
    localized[DEFAULT_LOCALE] = `Адмін ${surname}`;
  }
  return localized;
}