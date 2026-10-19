// 初期の項目定義(docs/spec.md「初期の項目定義」)。
// id は固定にして、何度起動しても同じ項目が二重に登録されないようにする。
// 文言や構成を変えるときは、ここを直したうえで migrations.ts に移行処理を書く(過去の記録は消さない)。

import type { ItemDef } from './types'

export const ITEM_IDS = {
  sleepCount: '00000000-0000-4000-8000-000000000001',
  activity: '00000000-0000-4000-8000-000000000002',
  mood: '00000000-0000-4000-8000-000000000003',
  moodExtra: '00000000-0000-4000-8000-000000000004',
  medicine: '00000000-0000-4000-8000-000000000005',
  meal: '00000000-0000-4000-8000-000000000006',
  outing: '00000000-0000-4000-8000-000000000007',
  talk: '00000000-0000-4000-8000-000000000008',
  memo: '00000000-0000-4000-8000-000000000009',
} as const

type SeedItem = Omit<ItemDef, 'createdAt' | 'updatedAt' | 'deletedAt' | 'visible' | 'shareDefault'>

export const SEED_ITEMS: SeedItem[] = [
  {
    id: ITEM_IDS.sleepCount,
    name: '睡眠の回数(自己申告)',
    inputType: 'single',
    options: ['0回', '1回', '2回', '3回以上'],
    range: null,
    order: 1,
    core: true,
    useTimeSlots: false,
    multiplePerDay: false,
  },
  {
    id: ITEM_IDS.activity,
    name: '活動量',
    inputType: 'single',
    options: ['ほぼ動けず', 'ふつう', '活発'],
    range: null,
    order: 2,
    core: true,
    useTimeSlots: true,
    multiplePerDay: false,
  },
  {
    id: ITEM_IDS.mood,
    name: '気分',
    inputType: 'slider',
    options: [],
    range: { min: -3, max: 3, step: 1 },
    order: 3,
    core: true,
    useTimeSlots: false,
    multiplePerDay: true,
  },
  {
    id: ITEM_IDS.moodExtra,
    name: '気分の補足',
    inputType: 'multi',
    options: [
      'いつもより少し軽い',
      'いつもより元気すぎる',
      'イライラが強い',
      '考えが次々浮かぶ',
      '眠らなくても平気だった',
      '衝動的に買い物をした',
    ],
    range: null,
    order: 4,
    core: false,
    useTimeSlots: false,
    multiplePerDay: false,
  },
  {
    id: ITEM_IDS.medicine,
    name: '服薬',
    inputType: 'check',
    options: ['服薬した'],
    range: null,
    order: 5,
    core: false,
    useTimeSlots: false,
    multiplePerDay: false,
  },
  {
    id: ITEM_IDS.meal,
    name: '食事',
    inputType: 'check',
    options: ['食べた'],
    range: null,
    order: 6,
    core: false,
    useTimeSlots: true,
    multiplePerDay: false,
  },
  {
    id: ITEM_IDS.outing,
    name: '外出',
    inputType: 'check',
    options: ['外出した'],
    range: null,
    order: 7,
    core: false,
    useTimeSlots: false,
    multiplePerDay: false,
  },
  {
    id: ITEM_IDS.talk,
    name: '人と話した',
    inputType: 'check',
    options: ['話した'],
    range: null,
    order: 8,
    core: false,
    useTimeSlots: false,
    multiplePerDay: false,
  },
  {
    id: ITEM_IDS.memo,
    name: '一言メモ',
    inputType: 'memo',
    options: [],
    range: null,
    order: 9,
    core: false,
    useTimeSlots: false,
    multiplePerDay: false,
  },
]

export function buildSeedItem(seed: SeedItem, now: string): ItemDef {
  return {
    ...seed,
    visible: true,
    shareDefault: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}
