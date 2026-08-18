import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_PATHS = [
  path.join(__dirname, '..', '..', 'client', 'src', 'i18n'),
  path.join(__dirname, '..', 'src', 'i18n')
];

const HISTORY_DIR = path.join(__dirname, '..', 'translate-history');
const REPO_ROOT = path.join(__dirname, '..', '..');

let logContent = '';

function log(message) {
  const time = new Date().toISOString().split('T')[1].split('.')[0];
  const logMsg = `[${time}] ${message}`;
  console.log(logMsg);
  logContent += logMsg + '\n';
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

function relPath(p) {
  return path.relative(REPO_ROOT, p);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function ensureHistoryDir() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    log(`📂 Created history directory: ${relPath(HISTORY_DIR)}`);
  }
}

function createBackup() {
  ensureHistoryDir();
  const backupsDir = path.join(HISTORY_DIR, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupsDir, `backup-${timestamp}`);
  fs.mkdirSync(backupPath, { recursive: true });

  log(`📦 Creating backup in: ${relPath(backupPath)}...`);

  for (const basePath of I18N_PATHS) {
    if (!fs.existsSync(basePath)) continue;
    const relFolderName = path.relative(REPO_ROOT, basePath).replace(/[\/\\]/g, '_');
    const targetDir = path.join(backupPath, relFolderName);

    fs.cpSync(basePath, targetDir, { recursive: true });
  }

  log(`✅ Backup successfully created.`);
  return backupPath;
}

function saveHistoryLog(label) {
  ensureHistoryDir();
  const timestamp = Date.now();
  const logFileName = `${label}-${timestamp}.log`;
  const logFilePath = path.join(HISTORY_DIR, logFileName);
  fs.writeFileSync(logFilePath, logContent, 'utf-8');
  console.log(`\n📝 Log file saved to: ${relPath(logFilePath)}`);
}

function getAvailableLanguages() {
  const languages = new Set();
  for (const basePath of I18N_PATHS) {
    if (fs.existsSync(basePath)) {
      const items = fs.readdirSync(basePath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          languages.add(item.name);
        }
      }
    }
  }
  return Array.from(languages);
}

function resolveDefaultFrom(availableLangs) {
  if (availableLangs.includes('en')) return 'en';
  return availableLangs[0];
}

const PLURAL_CATEGORIES = {
  ru: ['one', 'few', 'many', 'other'],
  uk: ['one', 'few', 'many', 'other'],
  be: ['one', 'few', 'many', 'other'],
  pl: ['one', 'few', 'many', 'other'],
  cs: ['one', 'few', 'many', 'other'],
  sk: ['one', 'few', 'many', 'other'],
  lt: ['one', 'few', 'many', 'other'],

  hr: ['one', 'few', 'other'],
  sr: ['one', 'few', 'other'],
  bs: ['one', 'few', 'other'],

  sl: ['one', 'two', 'few', 'other'],

  lv: ['zero', 'one', 'other'],

  ro: ['one', 'few', 'other'],

  fr: ['one', 'many', 'other'],

  en: ['one', 'other'],
  de: ['one', 'other'],
  nl: ['one', 'other'],
  es: ['one', 'other'],
  it: ['one', 'other'],
  pt: ['one', 'other'],
  sv: ['one', 'other'],
  da: ['one', 'other'],
  nb: ['one', 'other'],
  no: ['one', 'other'],
  fi: ['one', 'other'],
  el: ['one', 'other'],
  bg: ['one', 'other'],
  hu: ['one', 'other'],
  tr: ['one', 'other'],

  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
  he: ['one', 'two', 'many', 'other'],
  iw: ['one', 'two', 'many', 'other'],

  ja: ['other'],
  ko: ['other'],
  zh: ['other'],
  vi: ['other'],
  th: ['other'],
  id: ['other'],
  ms: ['other']
};

const PLURAL_SUFFIX_REGEX = /_(zero|one|two|few|many|other)$/i;

function pluralCategoriesFor(lang) {
  const base = lang.split('-')[0].toLowerCase();
  return PLURAL_CATEGORIES[base] || ['one', 'other'];
}

function sameCategorySet(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function findMatchingPluralLang(availableLangs, targetLang, excludeLang) {
  const targetCats = pluralCategoriesFor(targetLang);
  if (!targetCats) return null;

  for (const lang of availableLangs) {
    if (lang === targetLang || lang === excludeLang) continue;
    const cats = pluralCategoriesFor(lang);
    if (cats && sameCategorySet(cats, targetCats)) return lang;
  }
  return null;
}

function warnPluralMismatch(fromLang, targetLang, availableLangs) {
  const fromCats = pluralCategoriesFor(fromLang);
  const targetCats = pluralCategoriesFor(targetLang);
  if (!fromCats || !targetCats) return;

  const missingCats = targetCats.filter((c) => !fromCats.includes(c));
  if (missingCats.length === 0) return;

  console.log(`\n⚠️ Plural form mismatch: "${targetLang}" uses [${targetCats.join(', ')}] but "${fromLang}" only has [${fromCats.join(', ')}].`);
  console.log(`   Keys like "*_${missingCats.join('", "*_')}" won't have source text and may need manual review.`);

  const betterLang = findMatchingPluralLang(availableLangs, targetLang, fromLang);
  if (betterLang) {
    console.log(`   💡 Tip: "${betterLang}" has the same plural forms as "${targetLang}" — consider: translate ${targetLang} --from ${betterLang}`);
  }
}

function findBestBaseLangForTarget(targetLang, sourceLangs) {
  if (!sourceLangs || sourceLangs.length === 0) return 'en';
  if (sourceLangs.length === 1) return sourceLangs[0];

  const targetCats = pluralCategoriesFor(targetLang);
  let bestLang = sourceLangs[0];
  let maxScore = -Infinity;

  for (const srcLang of sourceLangs) {
    const srcCats = pluralCategoriesFor(srcLang);
    const shared = targetCats.filter((c) => srcCats.includes(c)).length;
    const total = new Set([...targetCats, ...srcCats]).size;
    const jaccard = total > 0 ? shared / total : 0;
    const isExact = sameCategorySet(targetCats, srcCats);

    const score = (isExact ? 10 : 0) + jaccard;
    if (score > maxScore) {
      maxScore = score;
      bestLang = srcLang;
    }
  }

  return bestLang;
}

function findPluralSourceValue(baseKey, targetCat, bestBaseLang, sourceLangs, sourcesData) {
  const targetPluralKey = `${baseKey}_${targetCat}`;

  if (sourcesData[bestBaseLang]?.[targetPluralKey] !== undefined) {
    return { text: sourcesData[bestBaseLang][targetPluralKey], fromLang: bestBaseLang };
  }

  for (const lang of sourceLangs) {
    if (sourcesData[lang]?.[targetPluralKey] !== undefined) {
      return { text: sourcesData[lang][targetPluralKey], fromLang: lang };
    }
  }

  const bestLangData = sourcesData[bestBaseLang] || {};
  for (const cat of ['other', 'one', 'few', 'many', 'two', 'zero']) {
    const candidateKey = `${baseKey}_${cat}`;
    if (bestLangData[candidateKey] !== undefined) {
      return { text: bestLangData[candidateKey], fromLang: bestBaseLang };
    }
  }

  for (const lang of sourceLangs) {
    const langData = sourcesData[lang] || {};
    for (const cat of ['other', 'one', 'few', 'many', 'two', 'zero']) {
      const candidateKey = `${baseKey}_${cat}`;
      if (langData[candidateKey] !== undefined) {
        return { text: langData[candidateKey], fromLang: lang };
      }
    }
  }

  return null;
}

function pruneInapplicablePluralKeys(struct, targetLang) {
  const targetCats = pluralCategoriesFor(targetLang);
  if (!targetCats) return struct;

  function prune(node) {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(prune);

    const result = {};
    for (const [key, value] of Object.entries(node)) {
      const match = key.match(PLURAL_SUFFIX_REGEX);
      if (match && !targetCats.includes(match[1].toLowerCase())) {
        continue;
      }

      const prunedValue = prune(value);
      if (prunedValue && typeof prunedValue === 'object' && !Array.isArray(prunedValue) && Object.keys(prunedValue).length === 0) {
        continue;
      }
      result[key] = prunedValue;
    }
    return result;
  }

  const pruned = prune(struct);
  return (pruned && typeof pruned === 'object' && !Array.isArray(pruned) && Object.keys(pruned).length === 0) ? null : pruned;
}

function getValueAtPath(obj, dotPath) {
  const parts = dotPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function countLeafKeys(obj) {
  if (obj === null || typeof obj !== 'object') return 1;
  const entries = Array.isArray(obj) ? obj : Object.values(obj);
  let count = 0;
  for (const val of entries) {
    count += countLeafKeys(val);
  }
  return count;
}

function getMissingKeysStructure(sourceObj, targetObj) {
  if (typeof sourceObj !== 'object' || sourceObj === null) return null;
  if (typeof targetObj !== 'object' || targetObj === null) return sourceObj;

  const missingObj = {};
  let hasMissing = false;

  for (const key of Object.keys(sourceObj)) {
    if (!(key in targetObj)) {
      missingObj[key] = sourceObj[key];
      hasMissing = true;
    } else if (typeof sourceObj[key] === 'object' && sourceObj[key] !== null) {
      const nestedMissing = getMissingKeysStructure(sourceObj[key], targetObj[key]);
      if (nestedMissing && Object.keys(nestedMissing).length > 0) {
        missingObj[key] = nestedMissing;
        hasMissing = true;
      }
    }
  }

  return hasMissing ? missingObj : null;
}

function deepMerge(target, source) {
  if (typeof source !== 'object' || source === null) {
    return source !== undefined ? source : target;
  }
  if (typeof target !== 'object' || target === null) {
    target = Array.isArray(source) ? [] : {};
  }
  const result = Array.isArray(source) ? [...target] : { ...target };
  for (const key of Object.keys(source)) {
    result[key] = deepMerge(target[key], source[key]);
  }
  return result;
}

function emptyStructure(obj) {
  if (obj === null || typeof obj !== 'object') return '';
  if (Array.isArray(obj)) return obj.map(emptyStructure);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = emptyStructure(value);
  }
  return result;
}

function buildMasterStructures(basePath, langs) {
  const allFiles = new Set();
  for (const lang of langs) {
    const dir = path.join(basePath, lang);
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).filter((f) => f.endsWith('.json')).forEach((f) => allFiles.add(f));
    }
  }

  const master = {};
  for (const file of allFiles) {
    let merged = {};
    for (const lang of langs) {
      const filePath = path.join(basePath, lang, file);
      if (fs.existsSync(filePath)) {
        merged = deepMerge(merged, readJson(filePath));
      }
    }
    master[file] = merged;
  }
  return master;
}

function cleanPlaceholderQuotes(text, originalPlaceholders) {
  let cleaned = text;
  cleaned = cleaned.replace(/[„“”«»]|&quot;/g, '"');
  originalPlaceholders.forEach((ph, idx) => {
    const regex = new RegExp(`__V${idx}__`, 'gi');
    cleaned = cleaned.replace(regex, ph);
  });
  return cleaned;
}

async function translateText(text, from, to, retries = 3) {
  if (!text || typeof text !== 'string' || !text.trim() || from === to) return text;

  const placeholders = [];
  const maskedText = text.replace(/\{[^}]+\}/g, (match) => {
    placeholders.push(match);
    return `__V${placeholders.length - 1}__`;
  });

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(maskedText)}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      } else {
        await new Promise((r) => setTimeout(r, 120));
      }

      const res = await fetch(url);
      if (res.status === 429) {
        log(`  ⚠️ Rate limited (429), waiting before retry...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

      const data = await res.json();
      if (data && data[0]) {
        const translated = data[0].map((item) => item[0]).join('');
        return cleanPlaceholderQuotes(translated, placeholders);
      }
    } catch (err) {
      if (attempt === retries - 1) {
        log(`  ❌ Translation error for text "${text}": ${err.message}`);
      }
    }
  }

  return text;
}

async function translateObject(obj, from, to) {
  if (typeof obj === 'string') {
    return await translateText(obj, from, to);
  }

  if (Array.isArray(obj)) {
    const newArr = [];
    for (const item of obj) {
      newArr.push(await translateObject(item, from, to));
    }
    return newArr;
  }

  if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = await translateObject(value, from, to);
    }
    return newObj;
  }

  return obj;
}

async function translateStructureSmart(node, keyPath, ctx) {
  if (typeof node === 'string') {
    const lastSegment = keyPath.split('.').pop() || '';
    let sourceLang = ctx.defaultFromLang;
    let sourceText = node;

    if (PLURAL_SUFFIX_REGEX.test(lastSegment)) {
      const altLang = findMatchingPluralLang(ctx.availableLangs, ctx.targetLang, ctx.defaultFromLang);
      if (altLang) {
        const altFilePath = path.join(ctx.basePath, altLang, ctx.file);
        if (fs.existsSync(altFilePath)) {
          const altValue = getValueAtPath(readJson(altFilePath), keyPath);
          if (typeof altValue === 'string' && altValue.trim()) {
            sourceLang = altLang;
            sourceText = altValue;
          }
        }
      }
    }

    return await translateText(sourceText, sourceLang, ctx.targetLang);
  }

  if (Array.isArray(node)) {
    const newArr = [];
    for (let i = 0; i < node.length; i++) {
      const nextPath = keyPath ? `${keyPath}.${i}` : String(i);
      newArr.push(await translateStructureSmart(node[i], nextPath, ctx));
    }
    return newArr;
  }

  if (typeof node === 'object' && node !== null) {
    const newObj = {};
    for (const [key, value] of Object.entries(node)) {
      const nextPath = keyPath ? `${keyPath}.${key}` : key;
      newObj[key] = await translateStructureSmart(value, nextPath, ctx);
    }
    return newObj;
  }

  return node;
}

function getNestedSources(sourcesData, key) {
  const nested = {};
  for (const [lang, data] of Object.entries(sourcesData)) {
    if (data && typeof data === 'object' && key in data) {
      nested[lang] = data[key];
    }
  }
  return nested;
}

async function syncObjectPluralAware(masterObj, targetObj, targetLang, sourceLangs, sourcesData) {
  if (typeof masterObj !== 'object' || masterObj === null) {
    return masterObj;
  }

  const targetCats = pluralCategoriesFor(targetLang);
  const bestBaseLang = findBestBaseLangForTarget(targetLang, sourceLangs);
  const result = typeof targetObj === 'object' && targetObj !== null && !Array.isArray(targetObj) ? { ...targetObj } : {};

  const pluralGroups = new Map();
  const normalKeys = [];

  for (const key of Object.keys(masterObj)) {
    const match = key.match(PLURAL_SUFFIX_REGEX);
    if (match) {
      const cat = match[1].toLowerCase();
      const baseKey = key.slice(0, -(cat.length + 1));
      if (!pluralGroups.has(baseKey)) {
        pluralGroups.set(baseKey, new Set());
      }
      pluralGroups.get(baseKey).add(cat);
    } else {
      normalKeys.push(key);
    }
  }

  for (const key of normalKeys) {
    const masterVal = masterObj[key];
    const targetVal = result[key];

    if (typeof masterVal === 'object' && masterVal !== null) {
      result[key] = await syncObjectPluralAware(
        masterVal,
        targetVal,
        targetLang,
        sourceLangs,
        getNestedSources(sourcesData, key)
      );
    } else {
      let srcVal = sourcesData[bestBaseLang]?.[key];
      let srcLang = bestBaseLang;
      if (srcVal === undefined) {
        for (const l of sourceLangs) {
          if (sourcesData[l]?.[key] !== undefined) {
            srcVal = sourcesData[l][key];
            srcLang = l;
            break;
          }
        }
      }

      const isMissing = targetVal === undefined || targetVal === null || targetVal === '';
      const isUntranslated = typeof targetVal === 'string' && typeof srcVal === 'string' && targetVal === srcVal && targetLang !== srcLang;

      if (isMissing || isUntranslated) {
        if (typeof srcVal === 'string') {
          result[key] = await translateText(srcVal, srcLang, targetLang);
        } else {
          result[key] = srcVal ?? masterVal;
        }
      }
    }
  }

  for (const [baseKey] of pluralGroups.entries()) {
    for (const targetCat of targetCats) {
      const targetPluralKey = `${baseKey}_${targetCat}`;

      const found = findPluralSourceValue(baseKey, targetCat, bestBaseLang, sourceLangs, sourcesData);
      if (found && typeof found.text === 'string') {
        const currentVal = result[targetPluralKey];
        const isMissing = currentVal === undefined || currentVal === null || currentVal === '';
        const isUntranslated = currentVal === found.text && targetLang !== found.fromLang;

        if (isMissing || isUntranslated) {
          result[targetPluralKey] = await translateText(found.text, found.fromLang, targetLang);
        }
      }
    }
  }

  for (const key of Object.keys(result)) {
    const match = key.match(PLURAL_SUFFIX_REGEX);
    if (match) {
      const cat = match[1].toLowerCase();
      const baseKey = key.slice(0, -(cat.length + 1));
      if (!pluralGroups.has(baseKey) || !targetCats.includes(cat)) {
        delete result[key];
      }
    } else if (!(key in masterObj)) {
      delete result[key];
    }
  }

  return result;
}

function buildMasterStructureFromSources(basePath, files, sourceLangs) {
  const masterByFile = {};
  for (const file of files) {
    let master = {};
    for (const lang of sourceLangs) {
      const filePath = path.join(basePath, lang, file);
      if (fs.existsSync(filePath)) {
        master = deepMerge(master, readJson(filePath));
      }
    }
    masterByFile[file] = master;
  }
  return masterByFile;
}

async function translateLanguage(targetLang, fromLang, opts = {}) {
  const { forceAll = false, empty = false } = opts;

  warnPluralMismatch(fromLang, targetLang, getAvailableLanguages());

  log(`\n🚀 ${empty ? 'Generating empty dictionary for' : 'Translating'} "${targetLang}" from "${fromLang}"${forceAll ? ' (force, all keys)' : ''}...`);

  let touchedAnything = false;

  for (const basePath of I18N_PATHS) {
    if (!fs.existsSync(basePath)) continue;

    const sourceDir = path.join(basePath, fromLang);
    if (!fs.existsSync(sourceDir)) continue;

    const targetDir = path.join(basePath, targetLang);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      log(`📂 Created target language directory: ${relPath(targetDir)}`);
    }

    const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.json'));
    if (files.length === 0) continue;

    log(`\n🔄 Processing directory: ${relPath(basePath)}`);

    for (const file of files) {
      const sourceFilePath = path.join(sourceDir, file);
      const targetFilePath = path.join(targetDir, file);
      const sourceJson = readJson(sourceFilePath);

      let targetJson = {};
      let toProcess = sourceJson;

      if (fs.existsSync(targetFilePath)) {
        targetJson = readJson(targetFilePath);

        if (!forceAll) {
          const missing = getMissingKeysStructure(sourceJson, targetJson);
          if (!missing) {
            log(`  ⏭️ Skipping ${file} (all keys are up to date)`);
            continue;
          }
          toProcess = missing;
        }
      }

      log(`  📄 Processing ${file}...`);
      touchedAnything = true;

      const processed = empty
        ? emptyStructure(toProcess)
        : await translateObject(toProcess, fromLang, targetLang);

      const finalJson = deepMerge(targetJson, processed);
      writeJson(targetFilePath, finalJson);
      log(`  ✅ Saved: ${relPath(targetFilePath)}`);
    }
  }

  if (!touchedAnything) {
    log(`\nℹ️ Nothing to do — source language "${fromLang}" not found, or "${targetLang}" is already up to date.`);
    return;
  }

  log(`\n🎉 Done for language "${targetLang}"!`);
  saveHistoryLog(`translate-${fromLang}-to-${targetLang}`);
}

async function syncCommand(opts = {}) {
  const { pluralAware = false, fromLangs = [] } = opts;
  const availableLangs = getAvailableLanguages();

  if (availableLangs.length === 0) {
    console.error('❌ No language directories found in i18n folders!');
    return;
  }

  if (pluralAware) {
    let selectedSources = [...fromLangs];

    if (selectedSources.length === 0) {
      console.log('\n⚠️ --plural-aware requires source language(s) to be explicitly specified.');
      const answer = await askQuestion('Specify base language(s) (comma-separated, e.g. "en" or "uk,en"): ');
      selectedSources = answer.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (selectedSources.length === 0) {
      console.error('❌ Error: You must specify at least one base language for --plural-aware sync!');
      return;
    }

    const invalidLangs = selectedSources.filter((l) => !availableLangs.includes(l));
    if (invalidLangs.length > 0) {
      console.error(`❌ Specified base language(s) do not exist: ${invalidLangs.join(', ')}`);
      return;
    }

    console.log(`\n🌐 Base source languages: [${selectedSources.join(', ')}]`);
    console.log(`🔄 Syncing languages: [${availableLangs.filter((l) => !selectedSources.includes(l)).join(', ')}]`);

    createBackup();

    for (const basePath of I18N_PATHS) {
      if (!fs.existsSync(basePath)) continue;

      const allFiles = new Set();
      for (const lang of selectedSources) {
        const dir = path.join(basePath, lang);
        if (fs.existsSync(dir)) {
          fs.readdirSync(dir).filter((f) => f.endsWith('.json')).forEach((f) => allFiles.add(f));
        }
      }

      const masterStructures = buildMasterStructureFromSources(basePath, Array.from(allFiles), selectedSources);

      for (const file of allFiles) {
        log(`\n📄 Processing file: ${file}`);

        const sourcesData = {};
        for (const lang of selectedSources) {
          sourcesData[lang] = readJson(path.join(basePath, lang, file));
        }

        for (const targetLang of availableLangs) {
          if (selectedSources.includes(targetLang)) continue;

          const targetDir = path.join(basePath, targetLang);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const targetFilePath = path.join(targetDir, file);
          const targetJson = readJson(targetFilePath);

          log(`  ⚙️ Syncing "${targetLang}"...`);

          const updatedJson = await syncObjectPluralAware(
            masterStructures[file],
            targetJson,
            targetLang,
            selectedSources,
            sourcesData
          );

          writeJson(targetFilePath, updatedJson);
          log(`  ✅ Saved: ${relPath(targetFilePath)}`);
        }
      }
    }

    log('\n🎉 Plural-aware sync complete!');
    saveHistoryLog('sync-plural-aware');
    return;
  }

  // Стандартний режим sync без --plural-aware
  console.log(`Checking ${availableLangs.length} languages...`);

  const primaryLang = resolveDefaultFrom(availableLangs);
  const mergeOrder = [...availableLangs.filter((l) => l !== primaryLang), primaryLang];

  const report = {};
  availableLangs.forEach((l) => { report[l] = { missing: 0, details: [] }; });

  for (const basePath of I18N_PATHS) {
    if (!fs.existsSync(basePath)) continue;

    const master = buildMasterStructures(basePath, mergeOrder);

    for (const [file, masterObj] of Object.entries(master)) {
      for (const lang of availableLangs) {
        const langFilePath = path.join(basePath, lang, file);
        const langJson = fs.existsSync(langFilePath) ? readJson(langFilePath) : {};
        const missingStruct = getMissingKeysStructure(masterObj, langJson);

        if (missingStruct) {
          report[lang].missing += countLeafKeys(missingStruct);
          report[lang].details.push({ basePath, file, missingStruct });
        }
      }
    }
  }

  for (const lang of availableLangs) {
    const missing = report[lang].missing;
    if (missing === 0) {
      console.log(`✓ ${lang} — complete`);
    } else {
      const word = missing === 1 ? 'missing key' : 'missing keys';
      console.log(`⚠️ ${lang} — ${missing} ${word}`);
    }
  }

  const anyMissing = availableLangs.some((l) => report[l].missing > 0);
  if (!anyMissing) {
    console.log('\n🎉 All languages are already in sync!');
    return;
  }

  const answer = await askQuestion('Add missing keys automatically? [y/N] ');
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    return;
  }

  createBackup();

  for (const lang of availableLangs) {
    const { missing, details } = report[lang];
    if (missing === 0) continue;

    for (const { basePath, file, missingStruct } of details) {
      const targetDir = path.join(basePath, lang);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        log(`📂 Created target language directory: ${relPath(targetDir)}`);
      }

      const targetFilePath = path.join(targetDir, file);
      const targetJson = fs.existsSync(targetFilePath) ? readJson(targetFilePath) : {};

      log(`  📄 Translating missing keys for ${lang}/${file}...`);

      const translated = await translateObject(missingStruct, primaryLang, lang);
      const finalJson = deepMerge(targetJson, translated);
      writeJson(targetFilePath, finalJson);
      log(`  ✅ Updated: ${relPath(targetFilePath)}`);
    }
  }

  log('\n🎉 Sync complete!');
  saveHistoryLog('sync');
}

async function removeCommand(lang) {
  if (!lang) {
    console.error('❌ Please specify a language to remove, e.g. "remove pl"');
    return;
  }

  const targets = [];
  let totalFiles = 0;
  let totalKeys = 0;

  for (const basePath of I18N_PATHS) {
    const dir = path.join(basePath, lang);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    let keys = 0;
    for (const file of files) {
      keys += countLeafKeys(readJson(path.join(dir, file)));
    }

    targets.push({ dir, files: files.length, keys });
    totalFiles += files.length;
    totalKeys += keys;
  }

  if (targets.length === 0) {
    console.log(`Language "${lang}" was not found in any i18n directory.`);
    return;
  }

  console.log('⚠️ This will delete:');
  for (const t of targets) {
    console.log(`  ${relPath(t.dir)}/`);
  }
  console.log(`  ${totalFiles} files`);
  console.log(`  ${totalKeys} translation keys`);

  const answer = await askQuestion('Are you sure? [y/N] ');
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    return;
  }

  for (const t of targets) {
    fs.rmSync(t.dir, { recursive: true, force: true });
  }

  console.log(`✅ Removed language "${lang}".`);
}

function flattenKeyPaths(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object') {
    return [prefix];
  }
  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v])
    : Object.entries(obj);

  let paths = [];
  for (const [key, value] of entries) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    paths = paths.concat(flattenKeyPaths(value, nextPrefix));
  }
  return paths;
}

function statusCommand(verbose = false) {
  const availableLangs = getAvailableLanguages();
  if (availableLangs.length === 0) {
    console.log('No languages found.');
    return;
  }

  let masterKeyCount = 0;
  const perLangFiles = {};
  const perLangMissing = {};
  const perLangDetails = {};
  availableLangs.forEach((l) => { perLangFiles[l] = 0; perLangMissing[l] = 0; perLangDetails[l] = []; });

  for (const basePath of I18N_PATHS) {
    if (!fs.existsSync(basePath)) continue;

    const master = buildMasterStructures(basePath, availableLangs);

    for (const [file, masterObj] of Object.entries(master)) {
      masterKeyCount += countLeafKeys(masterObj);

      for (const lang of availableLangs) {
        const filePath = path.join(basePath, lang, file);
        if (fs.existsSync(filePath)) {
          perLangFiles[lang] += 1;
          const missing = getMissingKeysStructure(masterObj, readJson(filePath));
          if (missing) {
            perLangMissing[lang] += countLeafKeys(missing);
            if (verbose) {
              const paths = flattenKeyPaths(missing).map((p) => `${file}: ${p}`);
              perLangDetails[lang].push(...paths);
            }
          }
        } else {
          perLangMissing[lang] += countLeafKeys(masterObj);
          if (verbose) {
            const paths = flattenKeyPaths(masterObj).map((p) => `${file}: ${p}`);
            perLangDetails[lang].push(...paths);
          }
        }
      }
    }
  }

  const rows = availableLangs.map((lang) => {
    const missing = perLangMissing[lang];
    const completion = masterKeyCount === 0
      ? 100
      : ((masterKeyCount - missing) / masterKeyCount) * 100;
    const completionStr = missing === 0 ? '100%' : `${completion.toFixed(1)}%`;
    return [lang, String(perLangFiles[lang]), String(masterKeyCount), String(missing), completionStr];
  });

  printTable(['Language', 'Files', 'Keys', 'Missing', 'Completion'], rows);

  if (verbose) {
    for (const lang of availableLangs) {
      if (perLangDetails[lang].length === 0) continue;
      console.log(`\n${lang} — missing keys:`);
      for (const p of perLangDetails[lang]) {
        console.log(`  - ${p}`);
      }
    }
  }
}

function printTable(header, rows) {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)) + 3
  );

  const formatRow = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join('').trimEnd();

  console.log(formatRow(header));
  console.log('-'.repeat(widths.reduce((a, b) => a + b, 0) - 3));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function printHelp() {
  console.log(`
i18n Translation CLI

Usage:
  node translate-i18n.js <command> [options]

Commands:
  translate <lang> [--from <lang>] [--empty] [--missing-only] [--force]
                       Add/update a language via machine translation
  sync [--plural-aware] [--from <langs>] 
                       Sync keys across all languages, filling gaps
  remove <lang>        Delete a language (with confirmation)
  status [--verbose]   Show a completion table for all languages
                       (--verbose also lists the exact missing key paths)
  help                 Show this help

Options for "translate":
  --from <lang>        Source language (default: en, or first available)
  --empty              Create empty string placeholders for manual translation
  --missing-only       Only translate missing keys (this is also the default)
  --force              Re-translate and overwrite every key

Options for "sync":
  --plural-aware       Enables plural-aware translation rules.
  --from <langs>       Base language(s) to sync from (comma-separated, e.g. "uk" or "uk,en").
                       Required when --plural-aware is set.

Examples:
  node translate-i18n.js translate pl
  node translate-i18n.js translate pl --from uk --force
  node translate-i18n.js translate de --empty
  node translate-i18n.js sync
  node translate-i18n.js sync --plural-aware --from uk
  node translate-i18n.js sync --plural-aware --from uk,en
  node translate-i18n.js remove ja
  node translate-i18n.js status
  node translate-i18n.js status --verbose

Running without any arguments opens an interactive menu.
`);
}

async function interactiveMenu() {
  console.log('===================================================');
  console.log('      i18n Translation CLI — Interactive Menu       ');
  console.log('===================================================\n');
  console.log('1) Translate a language (fill missing keys)');
  console.log('2) Generate empty dictionary for manual translation');
  console.log('3) Translate missing keys only (explicit)');
  console.log('4) Force re-translate all keys');
  console.log('5) Sync all languages (standard)');
  console.log('6) Sync with pluralization (--plural-aware)');
  console.log('7) Remove a language');
  console.log('8) Show status');
  console.log('9) Help');
  console.log('0) Exit');

  const choice = (await askQuestion('\nSelect an option: ')).trim();

  const availableLangs = getAvailableLanguages();
  const defaultFrom = resolveDefaultFrom(availableLangs);

  switch (choice) {
    case '1':
    case '2':
    case '3':
    case '4': {
      const lang = await askQuestion('Target language code: ');
      if (!lang) {
        console.log('❌ Language code is required.');
        break;
      }
      const from = (await askQuestion(`Source language [default: ${defaultFrom}]: `)) || defaultFrom;
      await translateLanguage(lang, from, {
        empty: choice === '2',
        forceAll: choice === '4'
      });
      break;
    }
    case '5': {
      await syncCommand({ pluralAware: false });
      break;
    }
    case '6': {
      const fromInput = await askQuestion('Base language(s) (comma-separated, e.g. "uk" or "uk,en"): ');
      const fromLangs = fromInput.split(',').map((s) => s.trim()).filter(Boolean);
      await syncCommand({ pluralAware: true, fromLangs });
      break;
    }
    case '7': {
      const lang = await askQuestion('Language code to remove: ');
      await removeCommand(lang);
      break;
    }
    case '8': {
      const verboseAns = await askQuestion('Show exact missing key paths? [y/N] ');
      statusCommand(verboseAns.toLowerCase() === 'y');
      break;
    }
    case '9':
      printHelp();
      break;
    case '0':
      console.log('Bye!');
      break;
    default:
      console.log('Invalid option.');
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const positional = [];
  const flags = { from: [], empty: false, missingOnly: false, force: false, verbose: false, pluralAware: false };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--from') {
      const val = args[++i];
      if (val) {
        val.split(',').forEach((s) => {
          const trimmed = s.trim();
          if (trimmed) flags.from.push(trimmed);
        });
      }
    } else if (arg === '--empty') {
      flags.empty = true;
    } else if (arg === '--missing-only') {
      flags.missingOnly = true;
    } else if (arg === '--force') {
      flags.force = true;
    } else if (arg === '--verbose') {
      flags.verbose = true;
    } else if (arg === '--plural-aware') {
      flags.pluralAware = true;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv);

  if (!command) {
    await interactiveMenu();
    return;
  }

  const availableLangs = getAvailableLanguages();
  const defaultFrom = resolveDefaultFrom(availableLangs);

  switch (command) {
    case 'translate': {
      const lang = positional[0];
      if (!lang) {
        console.error('❌ Please specify a language, e.g. "translate pl"');
        process.exit(1);
      }
      const from = flags.from[0] || defaultFrom;
      await translateLanguage(lang, from, {
        empty: flags.empty,
        forceAll: flags.force
      });
      break;
    }
    case 'sync':
      await syncCommand({ pluralAware: flags.pluralAware, fromLangs: flags.from });
      break;
    case 'remove':
      await removeCommand(positional[0]);
      break;
    case 'status':
      statusCommand(flags.verbose);
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.error(`❌ Unknown command: "${command}"`);
      printHelp();
      process.exit(1);
  }
}

main();