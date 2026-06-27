import type {
  PriceFormat,
  PriceTablePreparedItem,
  PriceTablePriceValue,
  PriceTableRawItem,
} from './types';

const AWAKEN_FORMATS: PriceFormat[] = [
  'epic',
  'unique',
  'legendary',
  'divine',
  'superior',
];

const TRANSCEND_FORMATS: PriceFormat[] = [
  'transcend epic',
  'transcend unique',
  'transcend legendary',
  'transcend divine',
  'transcend superior',
];

export function stagesByFormat(fmt?: string | null): string[] {
  const f = String(fmt ?? '').trim().toLowerCase() as PriceFormat;

  if (TRANSCEND_FORMATS.includes(f)) return ['거가', '거불'];
  if (AWAKEN_FORMATS.includes(f)) {
    return ['봉인', '1각', '2각', '3각', '4각', 'MAX'];
  }

  return ['가격'];
}

export function getPriceBadgeColor(stage: string, _type?: string | null) {
  switch (stage) {
    case '봉인':
      return '#444';
    case '1각':
    case '2각':
    case '3각':
    case '4각':
      return '#48ea6d';
    case 'MAX':
      return '#ffe360';
    case '거가':
      return '#43b04b';
    case '거불':
      return '#e44c4c';
    default:
      return '#5cacee';
  }
}

export function autoFont(
  base: number,
  text: string,
  steps?: Array<[number, number]>,
) {
  const len = Array.from(text ?? '').length;
  const rules: Array<[number, number]> =
    steps ??
    [
      [8, base],
      [12, base - 2],
      [16, base - 4],
      [22, base - 6],
      [30, base - 8],
      [40, base - 9],
    ];

  for (const [threshold, size] of rules) {
    if (len <= threshold) return size;
  }

  return Math.max(11, (rules.at(-1)?.[1] ?? base) - 2);
}

type SmartNameBreakInfo = {
  text: string;
  parts: string[];
  broke: boolean;
  firstPartLength: number;
  firstPartSpaceCount: number;
};

export function smartNameBreakInfo(
  nameRaw: string | null | undefined,
): SmartNameBreakInfo {
  const name = String(nameRaw ?? '');
  const chars = Array.from(name);
  const len = chars.length;
  const spaceCount = chars.reduce((acc, ch) => (ch === ' ' ? acc + 1 : acc), 0);

  if (len < 10 || spaceCount < 2) {
    return {
      text: name,
      parts: [name],
      broke: false,
      firstPartLength: 0,
      firstPartSpaceCount: 0,
    };
  }

  const breakAt = chars.findIndex((ch, i) => i >= 7 && ch === ' ');
  if (breakAt === -1) {
    return {
      text: name,
      parts: [name],
      broke: false,
      firstPartLength: 0,
      firstPartSpaceCount: 0,
    };
  }

  const first = chars.slice(0, breakAt).join('');
  const second = chars.slice(breakAt + 1).join('');

  if (!second.trim()) {
    return {
      text: name,
      parts: [name],
      broke: false,
      firstPartLength: 0,
      firstPartSpaceCount: 0,
    };
  }

  return {
    text: name,
    parts: [first, second],
    broke: true,
    firstPartLength: Array.from(first).length,
    firstPartSpaceCount: (first.match(/\s/g) ?? []).length,
  };
}

export function priceTableNameFontSize(name: string, brokeInfo?: SmartNameBreakInfo) {
  const info = brokeInfo ?? smartNameBreakInfo(name);

  if (info.broke) {
    const prefixRule = info.firstPartLength >= 8 && info.firstPartSpaceCount >= 1;
    return prefixRule ? 16 : 17;
  }

  return autoFont(20, String(name), [
    [7, 18],
    [9, 16],
    [12, 14],
    [16, 13],
    [20, 12],
  ]);
}

export function priceTablePriceFontSize(value: PriceTablePriceValue | null | undefined) {
  return autoFont(20, String(value ?? ''), [
    [8, 20],
    [12, 18],
    [16, 16],
    [22, 14],
    [30, 12],
    [40, 11],
  ]);
}

function coercePriceArray(v: any): PriceTablePriceValue[] | null {
  if (!v) return null;
  if (!Array.isArray(v)) return null;

  return v.map((value) => {
    if (typeof value === 'number') return value;
    return String(value ?? '');
  });
}

export function resolvePricesForStages(
  item: PriceTableRawItem,
  stages: string[],
): PriceTablePriceValue[] {
  const latest =
    coercePriceArray(item.latestPrices) ??
    coercePriceArray(item.pricesLatest) ??
    coercePriceArray(item.prices_latest) ??
    coercePriceArray(item.dbPrices) ??
    coercePriceArray(item.db_prices);

  if (latest && latest.length) {
    if (latest.length >= stages.length) return latest.slice(0, stages.length);
    return latest.concat(Array(stages.length - latest.length).fill(0));
  }

  const base = coercePriceArray(item.prices);
  if (base && base.length) {
    if (base.length >= stages.length) return base.slice(0, stages.length);
    return base.concat(Array(stages.length - base.length).fill(0));
  }

  const byStage =
    item.priceByStage ??
    item.pricesByStage ??
    item.prices_by_stage ??
    item.price_map ??
    null;

  if (byStage && typeof byStage === 'object') {
    return stages.map((stage) => {
      const value = byStage[stage];
      return value == null || value === '' ? 0 : value;
    });
  }

  const single = item.price ?? item.value ?? item.latestPrice ?? item.priceLatest;

  if (single != null && single !== '') {
    return Array(stages.length).fill(single);
  }

  return Array(stages.length).fill(0);
}

export function makePriceTableItemKey(
  item: PriceTableRawItem,
  index: number,
): string {
  if (item.id != null && String(item.id).trim()) return `id:${item.id}`;
  const nameKey = String(item.name_key ?? item.nameKey ?? '').trim();
  if (nameKey) return `key:${nameKey}`;
  const name = String(item.name ?? '').trim();
  if (name) return `name:${name}:${index}`;
  return `idx:${index}`;
}

export function preparePriceTableItems(
  items: PriceTableRawItem[] | null | undefined,
): PriceTablePreparedItem[] {
  const rows = Array.isArray(items) ? items : [];

  return rows.map((item, index) => {
    const stages =
      Array.isArray(item.stages) && item.stages.length
        ? item.stages.map((stage) => String(stage ?? ''))
        : stagesByFormat(item.mode);

    const prices = resolvePricesForStages(item, stages);
    const nameKey = String(item.name_key ?? item.nameKey ?? '').trim();
    const displayName = String(item.name ?? '').trim() || '이름 없음';

    return {
      ...item,
      viewKey: makePriceTableItemKey(item, index),
      nameKey,
      displayName,
      stages,
      prices,
    };
  });
}

export const RDW_PALETTE = [
  '#5E2569',
  '#B746F8',
  '#F39C12',
  '#E74C3C',
  '#3498DB',
  '#1ABC9C',
  '#309C49',
  '#F1C40F',
  '#DDB89E',
  '#34495E',
] as const;

export type ColoredChunk = { text: string; color?: string };

export function colorForLevel(lv: number) {
  if (!Number.isFinite(lv) || lv < 1 || lv > 10) return '#5b80f5';
  return RDW_PALETTE[10 - lv];
}

export function isProbablyCompressedPrice(s: string) {
  return /^[0-9:~\s]+$/.test(s ?? '');
}

export function tokenizeCompressedForColor(input: string): ColoredChunk[] {
  const s0 = String(input ?? '').trim().replace(/\s+/g, '');
  if (!s0) return [{ text: '' }];

  let s = s0;
  const out: ColoredChunk[] = [];

  if (s.startsWith('10:')) {
    const rest = s.slice(3);

    if (/^\d+$/.test(rest)) {
      const use2 = rest.length >= 2 && (rest.length - 2) % 2 === 0;
      const take = use2 ? 2 : 1;
      const nPart = rest.slice(0, take);

      out.push({ text: `10:${nPart}`, color: colorForLevel(10) });
      s = rest.slice(take);
    } else {
      return [{ text: s0 }];
    }
  }

  if (s.startsWith('10')) {
    const rem = s.length - 2;

    if (rem >= 1) {
      const two = rem >= 2 && rem % 2 === 0;
      const take = two ? 2 : 1;
      const nPart = s.slice(2, 2 + take);

      out.push({ text: `10${nPart}`, color: colorForLevel(10) });
      s = s.slice(2 + take);
    } else {
      out.push({ text: '10', color: colorForLevel(10) });
      s = '';
    }
  }

  for (let i = 0; i < s.length; ) {
    if (i + 1 >= s.length) {
      out.push({ text: s.slice(i) });
      break;
    }

    const token = s.slice(i, i + 2);
    const lv = parseInt(token[0], 10);

    if (Number.isFinite(lv) && lv >= 1 && lv <= 9) {
      out.push({ text: token, color: colorForLevel(lv) });
    } else {
      out.push({ text: token });
    }

    i += 2;
  }

  return out.length ? out : [{ text: s0 }];
}
