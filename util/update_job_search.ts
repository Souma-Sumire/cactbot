import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = 'E:\\Github\\ffxiv-datamining-hexcode-mixed\\chs\\Action.csv';
const targetTsPath = path.join(__dirname, '../ui/raidboss/emulator/data/CombatantJobSearch.ts');

const classJobToJob: { [key: number]: string } = {
  1: 'PLD', 19: 'PLD',
  2: 'MNK', 20: 'MNK',
  3: 'WAR', 21: 'WAR',
  4: 'DRG', 22: 'DRG',
  5: 'BRD', 23: 'BRD',
  6: 'WHM', 24: 'WHM',
  7: 'BLM', 25: 'BLM',
  26: 'SMN', 27: 'SMN',
  28: 'SCH',
  29: 'NIN', 30: 'NIN',
  31: 'MCH',
  32: 'DRK',
  33: 'AST',
  34: 'SAM',
  35: 'RDM',
  36: 'BLU',
  37: 'GNB',
  38: 'DNC',
  39: 'RPR',
  40: 'SGE',
  41: 'VPR',
  42: 'PCT',
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseOriginalJobAbilities(
  tsContent: string,
): { jobOrder: string[]; jobArrays: { [job: string]: number[] } } {
  const jobOrder: string[] = [];
  const jobArrays: { [job: string]: number[] } = {};

  const jobBlockRegex = /([A-Z0-9]+):\s*\[([\s\S]*?)\]/g;
  let match;

  while ((match = jobBlockRegex.exec(tsContent)) !== null) {
    const job = match[1];
    const body = match[2];
    if (!job || !body)
      continue;

    jobOrder.push(job);
    const numbers = body.split(',').map((s) => {
      const clean = s.split('//')[0]?.trim() ?? '';
      return parseInt(clean, 10);
    }).filter((n) => !isNaN(n));
    jobArrays[job] = numbers;
  }

  return { jobOrder, jobArrays };
}

function main() {
  // Get original base content from upstream git commit dc236d0a6
  let originalBaseContent = '';
  try {
    originalBaseContent = execSync('git show dc236d0a6:ui/raidboss/emulator/data/CombatantJobSearch.ts', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
    });
  } catch {
    originalBaseContent = fs.readFileSync(targetTsPath, 'utf-8');
  }

  const { jobOrder: baseJobOrder, jobArrays: baseJobArrays } = parseOriginalJobAbilities(originalBaseContent);

  // Parse Action.csv
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  if (lines.length < 5) {
    console.error('CSV file too short');
    return;
  }

  const header = parseCsvLine(lines[1] ?? '');
  const keyIdx = 0;
  const nameIdx = header.indexOf('Name') !== -1 ? header.indexOf('Name') : 1;
  const classJobIdx = header.indexOf('ClassJob');
  const isPvPIdx = header.indexOf('IsPvP');

  console.log(`Column Indices - Name: ${nameIdx}, ClassJob: ${classJobIdx}, IsPvP: ${isPvPIdx}`);

  if (classJobIdx === -1 || isPvPIdx === -1) {
    console.error('Failed to locate required column headers');
    return;
  }

  const newJobAbilities: { [job: string]: Set<number> } = {};
  const actionNames: { [id: number]: string } = {};

  for (let i = 4; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (!line)
      continue;

    const row = parseCsvLine(line);
    const key = parseInt(row[keyIdx] ?? '', 10);
    const name = (row[nameIdx] ?? '').trim();
    const classJob = parseInt(row[classJobIdx] ?? '', 10);
    const isPvP = (row[isPvPIdx] ?? '').trim().toLowerCase();

    if (isNaN(key))
      continue;

    if (name) {
      actionNames[key] = name;
    }

    if (isNaN(classJob))
      continue;

    if (isPvP === 'false') {
      const jobKey = classJobToJob[classJob];
      if (jobKey) {
        if (!newJobAbilities[jobKey]) {
          newJobAbilities[jobKey] = new Set<number>();
        }
        newJobAbilities[jobKey]?.add(key);
      }
    }
  }

  const finalJobOrder = [...baseJobOrder];
  for (const job of Object.values(classJobToJob)) {
    if (!finalJobOrder.includes(job)) {
      finalJobOrder.push(job);
    }
  }

  let tsAbilitiesContent = '  static readonly abilities: { [job in Job]?: number[] } = {\n';

  for (const job of finalJobOrder) {
    const existingList = baseJobArrays[job] ?? [];
    const existingSet = new Set(existingList);
    const newIds = Array.from(newJobAbilities[job] || []).filter((id) => !existingSet.has(id)).sort(
      (a, b) => a - b,
    );

    console.log(
      `${job}: ${existingList.length} original (no comment) + ${newIds.length} new additions (with comment) = ${existingList.length + newIds.length} total`,
    );

    tsAbilitiesContent += `    ${job}: [\n`;
    // Existing original items without comments
    for (const id of existingList) {
      tsAbilitiesContent += `      ${id},\n`;
    }
    // New items WITH comments
    for (const id of newIds) {
      const skillName = actionNames[id];
      if (skillName) {
        tsAbilitiesContent += `      ${id}, // ${skillName}\n`;
      } else {
        tsAbilitiesContent += `      ${id},\n`;
      }
    }
    tsAbilitiesContent += `    ],\n`;
  }

  tsAbilitiesContent += '  };';

  let tsFile = fs.readFileSync(targetTsPath, 'utf-8');
  const abilitiesRegex =
    /static readonly abilities: \{ \[job in Job\]\?: number\[\] \} = \{[\s\S]*?\};/;

  if (!abilitiesRegex.test(tsFile)) {
    console.error('Could not find static readonly abilities in CombatantJobSearch.ts');
    return;
  }

  tsFile = tsFile.replace(abilitiesRegex, tsAbilitiesContent);
  fs.writeFileSync(targetTsPath, tsFile, 'utf-8');
  console.log('Successfully updated CombatantJobSearch.ts with comments ONLY on new additions!');
}

main();
