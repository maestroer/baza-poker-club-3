// Оформление 3D-сцены: цвета стола, фишек, карт и надписи на них.
// Цвета страницы (текст, кнопки, фон секций) — в начале app/globals.css.
// Палитра ФЛЭШ: почти чёрный шоколад, медь и металлическое золото, как в логотипе.

export type ChipStyle = {
  base: string;
  inlay: string;
  insert: string;
  value: string;
  /** Цвет номинала и колец. Если не задан — металлическое золото. */
  foil?: string;
};

export const THEME = {
  /** Надпись по кругу на фишках и на картах */
  brand: "ФЛЭШ",
  /** Знак в центре рубашки карт; пустая строка — пиковая масть, как буква «Ф» в логотипе */
  monogram: "",
  /** Шрифт для номиналов и букв на картах (системный, рисуется на canvas) */
  serif: `Georgia, "Times New Roman", serif`,

  /** Знак в центре фишки; font: "serif" — шрифт выше, "brand" — шрифт названия с сайта */
  chipMark: { text: "ФЛЭШ", font: "brand" as "serif" | "brand" },
  /** Логотип, напечатанный на сукне в центре стола */
  tableLogo: {
    monogram: "", // знак в круге над названием; пусто — без круга
    title: "ФЛЭШ",
    sub: "КЛУБ СПОРТИВНОГО ПОКЕРА",
    font: "brand" as "serif" | "brand",
  },

  /** Фон сцены: медное свечение в правом нижнем углу уходит в темноту, как на логотипе */
  bg: { inner: "#9a4416", outer: "#0b0605", focus: [0.95, 0.9] as [number, number] },

  gold: "#dcaa5c", // фольга на фишках и картах
  goldMetal: 0xe2b066, // инкрустация стола и фаска кнопки
  ivory: "#f3e6d0",

  felt: { color: 0x5e2c15, sheen: 0xd47a3c, line: "255,226,180" },
  leather: { color: 0x120a07, sheen: 0x6b3a20 },

  chips: [
    { base: "#120c0a", inlay: "#0a0706", insert: "#dcaa5c", value: "1000" },
    { base: "#a5481b", inlay: "#843913", insert: "#f3e6d0", value: "500" },
    { base: "#3b2016", inlay: "#2c170f", insert: "#dcaa5c", value: "100" },
    { base: "#efe4d0", inlay: "#f6eddc", insert: "#a5481b", value: "25", foil: "#7a3412" },
  ] satisfies ChipStyle[],

  card: { face: "#f6efe2", spade: "#16100c", heart: "#b0301c", back: "#1c0e08" },
  allIn: { lacquer: "#a5481b", text: "#f3e6d0" },
};
