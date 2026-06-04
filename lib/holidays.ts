export interface Holiday {
  date: string   // YYYY-MM-DD
  name: string
  isSubstitute?: boolean
}

// 固定祝日
const FIXED = [
  { month: 1,  day: 1,  name: '元日' },
  { month: 2,  day: 11, name: '建国記念の日' },
  { month: 2,  day: 23, name: '天皇誕生日' },
  { month: 4,  day: 29, name: '昭和の日' },
  { month: 5,  day: 3,  name: '憲法記念日' },
  { month: 5,  day: 4,  name: 'みどりの日' },
  { month: 5,  day: 5,  name: 'こどもの日' },
  { month: 8,  day: 11, name: '山の日' },
  { month: 11, day: 3,  name: '文化の日' },
  { month: 11, day: 23, name: '勤労感謝の日' },
]

// ハッピーマンデー (月, 第n週, 曜日=1:月)
const NTH_WEEKDAY = [
  { month: 1,  nth: 2, wd: 1, name: '成人の日' },
  { month: 7,  nth: 3, wd: 1, name: '海の日' },
  { month: 9,  nth: 3, wd: 1, name: '敬老の日' },
  { month: 10, nth: 2, wd: 1, name: 'スポーツの日' },
]

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function nthWeekdayOf(year: number, month: number, weekday: number, nth: number): Date {
  const d = new Date(year, month - 1, 1)
  let count = 0
  while (true) {
    if (d.getDay() === weekday) {
      count++
      if (count === nth) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
}

// 春分・秋分（近似式、1980–2099年有効）
function vernalEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}
function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

export function getHolidaysForYear(year: number): Map<string, Holiday> {
  const map = new Map<string, Holiday>()

  const add = (date: Date, name: string, isSubstitute = false) => {
    map.set(toKey(date), { date: toKey(date), name, isSubstitute })
  }

  // 固定祝日
  for (const { month, day, name } of FIXED) {
    add(new Date(year, month - 1, day), name)
  }

  // 春分・秋分
  add(new Date(year, 2, vernalEquinox(year)), '春分の日')
  add(new Date(year, 8, autumnalEquinox(year)), '秋分の日')

  // ハッピーマンデー
  for (const { month, nth, wd, name } of NTH_WEEKDAY) {
    add(nthWeekdayOf(year, month, wd, nth), name)
  }

  // 振替休日: 祝日が日曜 → 翌月曜（すでに祝日なら翌々日…）
  const keys = Array.from(map.keys()).sort()
  for (const key of keys) {
    const d = new Date(key)
    if (d.getDay() === 0) {   // 日曜
      let sub = new Date(d)
      sub.setDate(sub.getDate() + 1)
      while (map.has(toKey(sub))) {
        sub.setDate(sub.getDate() + 1)
      }
      add(sub, map.get(key)!.name + '（振替休日）', true)
    }
  }

  // 国民の休日: 祝日に挟まれた平日（例: 5月4日以外）
  // 敬老の日と秋分の日の間が1日の場合（9月）
  const allKeys = Array.from(map.keys()).sort()
  for (let i = 0; i < allKeys.length - 1; i++) {
    const d1 = new Date(allKeys[i])
    const d2 = new Date(allKeys[i + 1])
    const diff = (d2.getTime() - d1.getTime()) / 86400000
    if (diff === 2) {
      const between = new Date(d1)
      between.setDate(between.getDate() + 1)
      if (between.getDay() !== 0 && between.getDay() !== 6 && !map.has(toKey(between))) {
        add(between, '国民の休日')
      }
    }
  }

  return map
}

// 複数年をまとめて取得するキャッシュ付きヘルパー
const cache = new Map<number, Map<string, Holiday>>()

export function getHolidayMap(year: number): Map<string, Holiday> {
  if (!cache.has(year)) cache.set(year, getHolidaysForYear(year))
  return cache.get(year)!
}

export function getHoliday(date: Date): Holiday | null {
  const map = getHolidayMap(date.getFullYear())
  return map.get(toKey(date)) ?? null
}
