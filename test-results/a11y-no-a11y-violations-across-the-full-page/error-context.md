# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> no a11y violations across the full page
- Location: e2e/a11y.spec.ts:5:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: ""
Received: "color-contrast: .text-transparent.hero-letter:nth-child(1)
color-contrast: .text-transparent.hero-letter:nth-child(2)
color-contrast: .text-transparent.hero-letter:nth-child(3)
color-contrast: .text-transparent.hero-letter:nth-child(4)
color-contrast: .text-transparent.hero-letter:nth-child(5)
color-contrast: .bg-gradient-to-t > span
color-contrast: .pb-7 > .text-xl.text-white.font-serif
color-contrast: .mt-0\\.5.text-white\\/40.tracking-wider
color-contrast: .space-y-4 > div:nth-child(1) > p
color-contrast: div:nth-child(1) > p > .text-emerald-300\\/90.relative.font-mono:nth-child(1)
color-contrast: div:nth-child(1) > p > .text-emerald-300\\/90.relative.font-mono:nth-child(2)
color-contrast: .space-y-4 > div:nth-child(2) > p
color-contrast: div:nth-child(2) > p > .text-emerald-300\\/90.relative.font-mono:nth-child(1)
color-contrast: div:nth-child(2) > p > .text-emerald-300\\/90.relative.font-mono:nth-child(2)
color-contrast: div:nth-child(3) > p
color-contrast: div:nth-child(3) > p > .text-emerald-300\\/90.relative.font-mono:nth-child(1)
color-contrast: div:nth-child(3) > p > .text-emerald-300\\/90.relative.font-mono:nth-child(2)
color-contrast: .text-emerald-300\\/90.relative.font-mono:nth-child(3)
color-contrast: .ml-1.text-emerald-300\\/90.font-mono
color-contrast: .tracking-\\[0\\.22em\\].text-white\\/35.text-\\[10px\\]
color-contrast: .mr-2
color-contrast: .tracking-wider.text-white\\/25.text-\\[10px\\]
color-contrast: .rounded-md > span
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(1) > .px-3\\.5.border-b.py-2\\.5 > .group-hover\\/card\\:text-emerald-200\\/70.ml-1.text-white\\/35
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(1) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(1) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(1) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(1) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(1) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(1) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(2) > .px-3\\.5.border-b.py-2\\.5 > .group-hover\\/card\\:text-emerald-200\\/70.ml-1.text-white\\/35
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(2) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(2) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(2) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(2) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(2) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(2) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(3) > .px-3\\.5.border-b.py-2\\.5 > .group-hover\\/card\\:text-emerald-200\\/70.ml-1.text-white\\/35
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(3) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(3) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(3) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(3) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(3) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(3) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(4) > .px-3\\.5.border-b.py-2\\.5 > .group-hover\\/card\\:text-emerald-200\\/70.ml-1.text-white\\/35
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(4) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(4) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(2) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(4) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(4) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(3) > code > .text-white\\/25:nth-child(3)
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(4) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-amber-200\\/80.group-hover\\/line\\:text-amber-100.duration-300
color-contrast: .shadow-\\[0_16px_40px_-16px_rgba\\(0\\,0\\,0\\,0\\.6\\)\\].group\\/card.hover\\:border-emerald-300\\/20:nth-child(4) > .overflow-x-auto.px-3\\.5.py-3 > .sm\\:text-\\[12px\\].text-\\[11px\\].leading-6 > .group\\/line.whitespace-pre.flex:nth-child(4) > code > .text-white\\/25:nth-child(3)
color-contrast: code > .ml-1.text-emerald-300\\/90[aria-hidden=\"true\"]
color-contrast: .mb-5 > .technical-label
color-contrast: .text-\\[11px\\].tracking-\\[0\\.14em\\].gap-2
color-contrast: .left-4
color-contrast: .text-white\\/75
color-contrast: .mt-0\\.5.truncate.block
color-contrast: .ml-4
color-contrast: .mt-0
color-contrast: .text-\\[15px\\]
color-contrast: .min-w-0:nth-child(1) > .sm\\:text-\\[1\\.7rem\\].text-emerald-200.tracking-\\[-0\\.03em\\] > .tabular-nums
color-contrast: .min-w-0:nth-child(1) > .leading-4.tracking-\\[0\\.13em\\]
color-contrast: .min-w-0:nth-child(2) > .sm\\:text-\\[1\\.7rem\\].text-emerald-200.tracking-\\[-0\\.03em\\] > .tabular-nums
color-contrast: .min-w-0:nth-child(2) > .leading-4.tracking-\\[0\\.13em\\]
color-contrast: .min-w-0:nth-child(3) > .sm\\:text-\\[1\\.7rem\\].text-emerald-200.tracking-\\[-0\\.03em\\] > .tabular-nums
color-contrast: .min-w-0:nth-child(3) > .leading-4.tracking-\\[0\\.13em\\]
color-contrast: .min-w-0:nth-child(4) > .sm\\:text-\\[1\\.7rem\\].text-emerald-200.tracking-\\[-0\\.03em\\] > .tabular-nums
color-contrast: .min-w-0:nth-child(4) > .leading-4.tracking-\\[0\\.13em\\]
color-contrast: .text-\\[13px\\].leading-5.text-white\\/55:nth-child(1) > span:nth-child(2)
color-contrast: .text-\\[13px\\].leading-5.text-white\\/55:nth-child(2) > span:nth-child(2)
color-contrast: .text-\\[13px\\].leading-5.text-white\\/55:nth-child(3) > span:nth-child(2)
color-contrast: .text-\\[13px\\].leading-5.text-white\\/55:nth-child(4) > span:nth-child(2)
color-contrast: .text-emerald-200.mb-1\\.5.tracking-\\[0\\.14em\\]
color-contrast: .text-emerald-200.mb-1\\.5.tracking-\\[0\\.14em\\] > .ml-2.sm\\:inline.truncate
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(2) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(2) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white > .ml-2.sm\\:inline.truncate
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(3) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(3) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white > .ml-2.sm\\:inline.truncate
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(4) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(4) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white > .ml-2.sm\\:inline.truncate
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(5) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(5) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white > .ml-2.sm\\:inline.truncate
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(6) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white
color-contrast: .py-2.outline-none.focus-visible\\:outline:nth-child(6) > .mb-1\\.5.tracking-\\[0\\.14em\\].hover\\:text-white > .ml-2.sm\\:inline.truncate
color-contrast: .eyebrow
color-contrast: .sm\\:text-4xl.text-3xl.mt-6
color-contrast: .sm\\:text-base.mt-3.max-w-xl
color-contrast: .pb-1
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .pt-1\\.5.text-lg.motion-safe\\:group-hover\\:-translate-y-1
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .leading-tight.motion-safe\\:group-hover\\:translate-x-2.sm\\:text-3xl
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .mt-1\\.5.tracking-\\[0\\.18em\\]
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[72px\\].mt-3.max-w-xl
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(1)
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(2)
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(3)
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(4)
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(5)
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(6)
color-contrast: article[aria-label=\"Real-Time Auction Platform\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-white\\/45.py-1.tracking-\\[0\\.12em\\]
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .pt-1\\.5.text-lg.motion-safe\\:group-hover\\:-translate-y-1
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .leading-tight.motion-safe\\:group-hover\\:translate-x-2.sm\\:text-3xl
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .mt-1\\.5.tracking-\\[0\\.18em\\]
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[72px\\].mt-3.max-w-xl
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(1)
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(2)
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(3)
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(4)
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(5)
color-contrast: article[aria-label=\"Medical Sample Management\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(6)
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .pt-1\\.5.text-lg.motion-safe\\:group-hover\\:-translate-y-1
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .leading-tight.motion-safe\\:group-hover\\:translate-x-2.sm\\:text-3xl
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .mt-1\\.5.tracking-\\[0\\.18em\\]
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[72px\\].mt-3.max-w-xl
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(1)
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(2)
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(3)
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(4)
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(5)
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-emerald-200\\/75.py-1.tracking-\\[0\\.12em\\]:nth-child(6)
color-contrast: article[aria-label=\"Fitness Center Digitalization\"] > .lg\\:grid-cols-\\[minmax\\(0\\,1\\.1fr\\)_minmax\\(0\\,0\\.9fr\\)\\].lg\\:gap-10.lg\\:items-stretch > .sm\\:gap-8.items-start.min-w-0 > .lg\\:min-h-\\[280px\\].lg\\:flex-col.lg\\:justify-center > .min-h-\\[76px\\].gap-1\\.5.flex-wrap > .text-white\\/45.py-1.tracking-\\[0\\.12em\\]
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(1) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .text-xs.tracking-wider.tabular-nums
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(1) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .tracking-\\[0\\.2em\\].mt-1.text-\\[9px\\]
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(2) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .text-xs.tracking-wider.tabular-nums
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(2) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .tracking-\\[0\\.2em\\].mt-1.text-\\[9px\\]
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(3) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .text-xs.tracking-wider.tabular-nums
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(3) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .tracking-\\[0\\.2em\\].mt-1.text-\\[9px\\]
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(4) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .text-xs.tracking-wider.tabular-nums
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(4) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .tracking-\\[0\\.2em\\].mt-1.text-\\[9px\\]
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(5) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .text-xs.tracking-wider.tabular-nums
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(5) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .tracking-\\[0\\.2em\\].mt-1.text-\\[9px\\]
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(6) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .text-xs.tracking-wider.tabular-nums
color-contrast: .lg\\:grid-cols-\\[140px_1fr\\].lg\\:gap-8.lg\\:grid:nth-child(6) > .lg\\:block.hidden > .sticky.top-28.pt-7 > .tracking-\\[0\\.2em\\].mt-1.text-\\[9px\\]"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#top"
  - banner [ref=e3]:
    - navigation "Primary navigation" [ref=e4]:
      - generic [ref=e5]: Iheb Saidi
      - generic [ref=e6]:
        - link "Home" [ref=e7] [cursor=pointer]:
          - /url: "#top"
          - text: Home
        - link "About" [ref=e9] [cursor=pointer]:
          - /url: "#about"
          - text: About
        - link "Work" [ref=e12] [cursor=pointer]:
          - /url: "#projects"
          - text: Work
        - link "Stack" [ref=e14] [cursor=pointer]:
          - /url: "#stack"
          - text: Stack
        - link "Experience" [ref=e16] [cursor=pointer]:
          - /url: "#experience"
          - text: Experience
        - link "Contact" [ref=e18] [cursor=pointer]:
          - /url: "#contact"
          - text: Contact
  - main [ref=e20]:
    - generic [ref=e21]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e29]: AVAILABLE FOR NEW OPPORTUNITIES
          - heading "Iheb Saidi, full-stack software engineer" [level=1] [ref=e30]:
            - generic [ref=e31]:
              - generic [ref=e32]:
                - generic [ref=e33]: I
                - generic [ref=e34]: h
                - generic [ref=e35]: e
                - generic [ref=e36]: b
              - generic [ref=e37]:
                - generic [ref=e38]: S
                - generic [ref=e39]: a
                - generic [ref=e40]: i
                - generic [ref=e41]: d
                - generic [ref=e42]: i
                - generic [ref=e43]: .
          - paragraph [ref=e44]:
            - text: ">_ I build"
            - generic [ref=e45]: scalable Spring Boot backends, reactive Angular frontends, and production-grade APIs.
            - generic [ref=e46]: scalable Spring Boot backends
          - paragraph [ref=e48]: Think deeply. Build simply. Ship reliably.
          - generic [ref=e49]:
            - link "View my work" [ref=e50] [cursor=pointer]:
              - /url: "#projects"
              - text: View my work
              - img [ref=e51]
            - link "Get in touch" [ref=e53] [cursor=pointer]:
              - /url: "#contact"
        - generic [ref=e55]:
          - generic [ref=e56]:
            - generic [ref=e60]: OpportunityController.java
            - generic [ref=e61]: UTF-8
          - code [ref=e63]: "@RestController @RequestMapping(\"/api/v1\") public class OpportunityController { private final Engineer iheb = Engineer.senior().stack(\"Java\", \"Spring\", \"Angular\").build(); @GetMapping(\"/hire\") public ResponseEntity<Offer> hire() { return ResponseEntity.ok(Offer.builder() .candidate(iheb) .availability(\"IMMEDIATE\") .relocation(true) .build()); } }"
          - generic [ref=e65]:
            - generic [ref=e66]: "build: success"
            - generic [ref=e68]: "tests: 42/42"
            - generic [ref=e69]: ready to ship
      - generic [ref=e70]:
        - generic [ref=e71]: TUNIS / TN
        - link "SCROLL" [ref=e72] [cursor=pointer]:
          - /url: "#projects"
          - text: SCROLL
        - generic [ref=e74]: "2026"
    - generic [ref=e76]:
      - generic [ref=e77]:
        - generic:
          - generic:
            - generic: 01 — ABOUT
        - generic [ref=e78]:
          - generic [ref=e79]:
            - generic [ref=e80]: "01"
            - text: ABOUT
          - heading "Engineer by training, builder by default." [level=2] [ref=e82]:
            - text: Engineer by training,
            - text: builder by default.
      - generic [ref=e84]:
        - generic [ref=e85]:
          - generic [ref=e86]:
            - generic [ref=e88]:
              - img "Iheb Saidi, Full Stack Software Engineer — Java · Spring Boot · Angular" [ref=e89]
              - generic [ref=e91]: PORTRAIT — 2025
            - generic [ref=e92]:
              - generic [ref=e93]: Iheb Saidi
              - generic [ref=e94]: Full Stack Software Engineer — Java · Spring Boot · Angular
          - generic [ref=e95]:
            - generic: "01"
            - generic [ref=e96]:
              - paragraph [ref=e98]:
                - text: I'm a full-stack engineer focused on
                - generic [ref=e99]: Spring Boot
                - text: backends and
                - generic [ref=e101]: Angular
                - text: frontends — working in the unglamorous middle where business logic, data, APIs, and user experience meet.
              - paragraph [ref=e104]:
                - text: I care about
                - generic [ref=e105]: clean architecture
                - text: ", observable systems, and code the next engineer can trust. I build software for real-world constraints, from"
                - generic [ref=e107]: event-driven microservices
                - text: to resilient delivery and production-ready systems.
              - paragraph [ref=e109]:
                - text: "AI is part of that stack too:"
                - generic [ref=e110]: RAG
                - text: pipelines with
                - generic [ref=e112]: pgvector
                - text: ","
                - generic [ref=e114]: Spring AI
                - text: integrations, and production-minded systems with proper testing and guardrails. I use AI to move faster — but I own the architecture, the engineering decisions, and everything that ships.▍
        - generic [ref=e117]:
          - generic [ref=e118]:
            - generic [ref=e119]: ▸~/stack
            - generic [ref=e121]: 4 FILES
            - 'button "Copy { \"backend\": [ \"Java / Spring Boot\", \"REST / Microservices\", \"PostgreSQL / Redis\" ], \"frontend\": [ \"Angular / RxJS\", \"TypeScript\", \"Tailwind CSS\" ], \"ai & llm\": [ \"Spring AI / LangChain4j\", \"OpenAI / Anthropic APIs\", \"pgvector / embeddings\" ], \"devops & cloud\": [ \"Docker / CI-CD\", \"AWS\", \"Observability\" ] }" [ref=e122] [cursor=pointer]':
              - generic [ref=e123]: copy
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e131]: backend.json
              - generic [ref=e133]:
                - code [ref=e135]: "["
                - code [ref=e137]: "\"Java / Spring Boot\" , // since 2019 · daily"
                - code [ref=e139]: "\"REST / Microservices\", // event-driven lately"
                - code [ref=e141]: "\"PostgreSQL / Redis\" // schemas & tuning"
                - code [ref=e143]: "]"
            - generic [ref=e144]:
              - generic [ref=e150]: frontend.json
              - generic [ref=e152]:
                - code [ref=e154]: "["
                - code [ref=e156]: "\"Angular / RxJS\", // since 2020"
                - code [ref=e158]: "\"TypeScript\" , // strict mode, always"
                - code [ref=e160]: "\"Tailwind CSS\" // design systems"
                - code [ref=e162]: "]"
            - generic [ref=e163]:
              - generic [ref=e169]: ai-llm.json
              - generic [ref=e171]:
                - code [ref=e173]: "["
                - code [ref=e175]: "\"Spring AI / LangChain4j\", // prod RAG pipelines"
                - code [ref=e177]: "\"OpenAI / Anthropic APIs\", // streaming · tools"
                - code [ref=e179]: "\"pgvector / embeddings\" // semantic search"
                - code [ref=e181]: "]"
            - generic [ref=e182]:
              - generic [ref=e188]: devops-cloud.json
              - generic [ref=e190]:
                - code [ref=e192]: "["
                - code [ref=e194]: "\"Docker / CI-CD\", // GitHub Actions"
                - code [ref=e196]: "\"AWS\" , // ECS · S3 · RDS"
                - code [ref=e198]: "\"Observability\" // Grafana stack"
                - code [ref=e200]: "]▍"
    - generic [ref=e202]:
      - generic [ref=e203]:
        - generic:
          - generic:
            - generic: 02 — SELECTED WORK
        - generic [ref=e204]:
          - generic [ref=e205]:
            - generic [ref=e206]: "02"
            - text: SELECTED WORK
          - heading "Professional experience & production systems." [level=2] [ref=e208]:
            - text: Professional experience &
            - text: production systems.
          - paragraph [ref=e209]: Industrial supervision, ITSM with AI integration, and full-stack delivery across five engagements — every item below shipped to production.
      - generic [ref=e210]:
        - region "Professional experience" [ref=e211]:
          - generic [ref=e213]:
            - generic [ref=e214]: 02 — SELECTED WORK
            - generic [ref=e215]: 01 / 06
          - generic [ref=e217]:
            - generic [ref=e219]:
              - generic [ref=e221]:
                - img "AgroRetail OS — Multi-tenant SaaS for Agricultural Retail product screenshot" [ref=e227]
                - generic [ref=e228]: "01"
              - generic [ref=e230]:
                - generic [ref=e231]:
                  - generic [ref=e232]: AgroRetail OS
                  - generic [ref=e233]: Tunis, Tunisia
                - generic [ref=e234]: 2026 – Present
            - generic [ref=e237]:
              - heading "Multi-tenant SaaS for Agricultural Retail" [level=3] [ref=e238]
              - paragraph [ref=e239]: connecting cooperatives, cashiers and farmers through secure POS, B2B and farmer-facing workflows.
              - generic [ref=e240]:
                - generic [ref=e241]:
                  - term [ref=e242]: concurrent cashiers — load test
                  - definition [ref=e243]: "50"
                  - definition [ref=e244]: concurrent cashiers — load test
                - generic [ref=e245]:
                  - term [ref=e246]: sales/min — load test
                  - definition [ref=e247]: "1000"
                  - definition [ref=e248]: sales/min — load test
                - generic [ref=e249]:
                  - term [ref=e250]: ms product search target
                  - definition [ref=e251]: "100"
                  - definition [ref=e252]: ms product search target
                - generic [ref=e253]:
                  - term [ref=e254]: ms dashboard target
                  - definition [ref=e255]: "500"
                  - definition [ref=e256]: ms dashboard target
              - list [ref=e257]:
                - listitem [ref=e258]:
                  - generic [ref=e260]: Engineered a multi-tenant SaaS platform with tenant-isolated data, role-based access and secure workflows for cooperatives, cashiers and farmers
                - listitem [ref=e261]:
                  - generic [ref=e263]: Built the Angular 17 Farmer Portal and POS experiences with secure authentication, responsive dashboards and offline-first transaction handling
                - listitem [ref=e264]:
                  - generic [ref=e266]: Implemented regulatory and document workflows including Certiphyto validation, asynchronous DRE generation and transactional Outbox processing
                - listitem [ref=e267]:
                  - generic [ref=e269]: Hardened the platform for production with OpenAPI APIs, API-key security, Resilience4j, observability, load testing and OWASP ZAP security auditing
          - generic [ref=e271]:
            - group "Choose experience" [ref=e272]:
              - 'button "Go to AgroRetail OS: Multi-tenant SaaS for Agricultural Retail" [ref=e273] [cursor=pointer]':
                - generic [ref=e274]: 01AgroRetail OS
              - 'button "Go to Novatek: Real-Time Industrial Supervision Platform" [ref=e277] [cursor=pointer]':
                - generic [ref=e278]: 02Novatek
              - 'button "Go to Tunisair: ITSM & AI Platform" [ref=e280] [cursor=pointer]':
                - generic [ref=e281]: 03Tunisair
              - 'button "Go to Xtensus: Client Management Platform" [ref=e283] [cursor=pointer]':
                - generic [ref=e284]: 04Xtensus
              - 'button "Go to World Soft Group: Hotel Management Platform" [ref=e286] [cursor=pointer]':
                - generic [ref=e287]: 05World Soft Group
              - 'button "Go to ISIMS: NLP Conversational Chatbot" [ref=e289] [cursor=pointer]':
                - generic [ref=e290]: 06ISIMS
            - generic [ref=e292]:
              - button "Previous experience" [disabled]:
                - img
              - button "Next experience" [ref=e293] [cursor=pointer]:
                - img [ref=e294]
          - paragraph [ref=e296]: "Experience 1 of 6: AgroRetail OS"
        - generic [ref=e297]:
          - generic [ref=e298]:
            - generic [ref=e299]:
              - paragraph [ref=e300]: 03 — OTHER BUILDS
              - heading "Notable academic projects" [level=3] [ref=e302]
              - paragraph [ref=e303]: Experiments and engineering builds from ESPRIT and Hôpital Charles Nicolle — technical breadth outside professional work.
            - generic [ref=e304]: 3 PROJECTS
          - list [ref=e305]:
            - listitem [ref=e306]:
              - article "Real-Time Auction Platform" [ref=e307]:
                - generic [ref=e308]:
                  - generic [ref=e309]:
                    - generic [ref=e310]: "01"
                    - generic [ref=e311]:
                      - heading "Real-Time Auction Platform" [level=3] [ref=e312]
                      - paragraph [ref=e313]: ESPRIT, Ariana · Sep 2023 – Nov 2023
                      - paragraph [ref=e314]: Distributed microservices auction system with automated CI/CD and enforced quality gates.
                      - generic [ref=e315]:
                        - generic [ref=e316]: Spring Boot
                        - generic [ref=e317]: Angular
                        - generic [ref=e318]: Microservices
                        - generic [ref=e319]: Eureka
                        - generic [ref=e320]: API Gateway
                        - generic [ref=e321]: Docker
                        - generic [ref=e322]: "+2"
                  - img "Real-Time Auction Platform — project screenshot" [ref=e325]
            - listitem [ref=e326]:
              - article "Medical Sample Management" [ref=e327]:
                - generic [ref=e328]:
                  - generic [ref=e329]:
                    - generic [ref=e330]: "02"
                    - generic [ref=e331]:
                      - heading "Medical Sample Management" [level=3] [ref=e332]
                      - paragraph [ref=e333]: Hôpital Charles Nicolle, Tunis · Feb 2023 – May 2023
                      - paragraph [ref=e334]: Medical sample management platform combining Angular and Spring Boot workflows with Python and R data-analytics modules.
                      - generic [ref=e335]:
                        - generic [ref=e336]: Spring Boot
                        - generic [ref=e337]: Angular
                        - generic [ref=e338]: Python
                        - generic [ref=e339]: R
                        - generic [ref=e340]: MySQL
                        - generic [ref=e341]: Data Mining
                  - img "Medical Sample Management — project screenshot" [ref=e344]
            - listitem [ref=e345]:
              - article "Fitness Center Digitalization" [ref=e346]:
                - generic [ref=e347]:
                  - generic [ref=e348]:
                    - generic [ref=e349]: "03"
                    - generic [ref=e350]:
                      - heading "Fitness Center Digitalization" [level=3] [ref=e351]
                      - paragraph [ref=e352]: ESPRIT, Ariana · Jan 2022 – May 2022
                      - paragraph [ref=e353]: Full-stack fitness center management and e-commerce platform covering administration modules and an online store.
                      - generic [ref=e354]:
                        - generic [ref=e355]: Java
                        - generic [ref=e356]: JavaFX
                        - generic [ref=e357]: Symfony
                        - generic [ref=e358]: MySQL
                        - generic [ref=e359]: JavaScript
                        - generic [ref=e360]: TypeScript
                        - generic [ref=e361]: "+2"
                  - img "Fitness Center Digitalization — project screenshot" [ref=e364]
    - region "Engineering values" [ref=e365]:
      - generic [ref=e367]:
        - generic [ref=e368]: Java
        - generic [ref=e370]: Spring Boot
        - generic [ref=e372]: Angular
        - generic [ref=e374]: TypeScript
        - generic [ref=e376]: Microservices
        - generic [ref=e378]: PostgreSQL
        - generic [ref=e380]: Docker
        - generic [ref=e382]: AI
        - generic [ref=e384]: CQRS
        - generic [ref=e386]: Java
        - generic [ref=e388]: Spring Boot
        - generic [ref=e390]: Angular
        - generic [ref=e392]: TypeScript
        - generic [ref=e394]: Microservices
        - generic [ref=e396]: PostgreSQL
        - generic [ref=e398]: Docker
        - generic [ref=e400]: AI
        - generic [ref=e402]: CQRS
        - generic [ref=e404]: Java
        - generic [ref=e406]: Spring Boot
        - generic [ref=e408]: Angular
        - generic [ref=e410]: TypeScript
        - generic [ref=e412]: Microservices
        - generic [ref=e414]: PostgreSQL
        - generic [ref=e416]: Docker
        - generic [ref=e418]: AI
        - generic [ref=e420]: CQRS
        - generic [ref=e422]: Java
        - generic [ref=e424]: Spring Boot
        - generic [ref=e426]: Angular
        - generic [ref=e428]: TypeScript
        - generic [ref=e430]: Microservices
        - generic [ref=e432]: PostgreSQL
        - generic [ref=e434]: Docker
        - generic [ref=e436]: AI
        - generic [ref=e438]: CQRS
    - generic [ref=e441]:
      - generic [ref=e442]:
        - generic:
          - generic:
            - generic: 03 — EXPERIENCE
        - generic [ref=e443]:
          - generic [ref=e444]:
            - generic [ref=e445]: "03"
            - text: EXPERIENCE
          - heading "Where I've shipped." [level=2] [ref=e447]
          - paragraph [ref=e448]: Full-time engineering and internship work — every role below shipped to production.
      - generic [ref=e452]:
        - generic [ref=e453]:
          - generic [ref=e456]:
            - text: "2026"
            - generic [ref=e457]: 2026 – Present
          - article [ref=e458]:
            - generic [ref=e459]:
              - generic [ref=e460]:
                - heading "Full Stack Engineer" [level=3] [ref=e461]
                - paragraph [ref=e462]: AgroRetail OS
              - generic [ref=e467]: PRESENT
            - list [ref=e468]:
              - listitem [ref=e469]: Designing a multi-tenant SaaS platform where tenant isolation, role-based access and traceability shape every architectural decision
              - listitem [ref=e471]: Learning to build offline-first POS and farmer-facing workflows that stay correct when connectivity is unreliable
              - listitem [ref=e473]: Implementing regulatory and document workflows — Certiphyto validation, asynchronous DRE generation, transactional Outbox processing
              - listitem [ref=e475]: Hardening the platform for production with load testing, observability, resilience patterns and OWASP ZAP security auditing
        - generic [ref=e477]:
          - generic [ref=e480]:
            - text: "2024"
            - generic [ref=e481]: Jul 2024 – Jan 2026
          - article [ref=e482]:
            - generic [ref=e484]:
              - heading "Full Stack Engineer" [level=3] [ref=e485]
              - paragraph [ref=e486]: Novatek (Délice Group)
            - list [ref=e487]:
              - listitem [ref=e488]: Learned to design systems around real production constraints where reliability, performance and traceability matter every day
              - listitem [ref=e490]: Grew from implementing features to owning backend architecture, security decisions and database performance
              - listitem [ref=e492]: Learned how real-time interfaces change when users depend on live operational data rather than static business screens
              - listitem [ref=e494]: Developed a stronger engineering discipline around testing, observability, code quality and maintainable architecture
        - generic [ref=e496]:
          - generic [ref=e499]:
            - text: "2024"
            - generic [ref=e500]: Jan 2024 – Jul 2024
          - article [ref=e501]:
            - generic [ref=e503]:
              - heading "Full Stack Developer" [level=3] [ref=e504]
              - paragraph [ref=e505]: Tunisair
            - list [ref=e506]:
              - listitem [ref=e507]: Learned to translate complex business processes into explicit, maintainable workflows instead of scattering business rules across the application
              - listitem [ref=e509]: Explored how AI can become part of an existing enterprise workflow rather than existing as an isolated feature
              - listitem [ref=e511]: Developed stronger ownership across requirements, architecture, implementation, testing and deployment
              - listitem [ref=e513]: Learned to work with enterprise systems where consistency, traceability and operational usability are equally important
        - generic [ref=e515]:
          - generic [ref=e518]:
            - text: "2023"
            - generic [ref=e519]: Jul 2023 – Aug 2023
          - article [ref=e520]:
            - generic [ref=e522]:
              - heading "Full Stack Developer (Internship)" [level=3] [ref=e523]
              - paragraph [ref=e524]: Xtensus, Ariana
            - list [ref=e525]:
              - listitem [ref=e526]: Learned how a real business requirement becomes an end-to-end feature across database, API and frontend layers
              - listitem [ref=e528]: Strengthened my understanding of reactive frontend development with Angular, TypeScript and RxJS
              - listitem [ref=e530]: Discovered the importance of clean API contracts and clear separation between frontend and backend responsibilities
        - generic [ref=e532]:
          - generic [ref=e535]:
            - text: "2022"
            - generic [ref=e536]: Jul 2022 – Sep 2022
          - article [ref=e537]:
            - generic [ref=e539]:
              - heading "Full Stack Developer (Internship)" [level=3] [ref=e540]
              - paragraph [ref=e541]: World Soft Group, Marsa
            - list [ref=e542]:
              - listitem [ref=e543]: Learned the fundamentals of building a complete web application around real operational workflows
              - listitem [ref=e545]: Gained my first practical experience connecting frontend interactions with backend business logic and persistent data
              - listitem [ref=e547]: Learned how small UX decisions can directly affect the efficiency of day-to-day users
        - generic [ref=e549]:
          - generic [ref=e552]:
            - text: "2021"
            - generic [ref=e553]: Feb 2021 – Jun 2021
          - article [ref=e554]:
            - generic [ref=e556]:
              - heading "Full Stack Developer" [level=3] [ref=e557]
              - paragraph [ref=e558]: ISIMS, Sfax — Bachelor's Final Project
            - list [ref=e559]:
              - listitem [ref=e560]: Discovered how machine-learning concepts can be turned into a usable application rather than remaining a research experiment
              - listitem [ref=e562]: Learned to connect an NLP model, REST API and web interface into one complete user experience
              - listitem [ref=e564]: Built the foundation for my interest in combining software engineering with AI-driven applications
    - generic [ref=e567]:
      - generic [ref=e568]:
        - generic:
          - generic:
            - generic: 04 — EDUCATION
        - generic [ref=e569]:
          - generic [ref=e570]:
            - generic [ref=e571]: "04"
            - text: EDUCATION
          - heading "Foundations." [level=2] [ref=e573]
      - generic [ref=e575]:
        - generic [ref=e576]:
          - generic [ref=e577]:
            - heading "Engineering Degree in Computer Science (Bac+5)" [level=3] [ref=e578]
            - paragraph [ref=e579]: ESPRIT
          - generic [ref=e581]: 2021–2024
        - generic [ref=e582]:
          - generic [ref=e583]:
            - heading "Bachelor's Degree in Computer Science (Bac+3)" [level=3] [ref=e584]
            - paragraph [ref=e585]: ISIMS Sfax
          - generic [ref=e587]: 2017–2021
    - generic [ref=e590]:
      - generic [ref=e595]: AVAILABLE FOR NEW OPPORTUNITIES
      - heading "Let's build something shipping-grade." [level=2] [ref=e596]
      - paragraph [ref=e597]: Full-stack roles, backend-heavy teams, or anything where the system has to stay up. Currently based in Tunis, open to relocation.
      - generic [ref=e598]:
        - link "Download résumé" [ref=e600] [cursor=pointer]:
          - /url: /cv-iheb-saidi.pdf
          - text: Download résumé
          - generic [ref=e601]: ↓
        - button ">_ iheb.saidi.it@gmail.com" [ref=e603] [cursor=pointer]:
          - generic [ref=e604]: ">_"
          - generic [ref=e605]: iheb.saidi.it@gmail.com
          - generic [ref=e606]: ⧉
      - generic [ref=e607]:
        - link "GitHub" [ref=e608] [cursor=pointer]:
          - /url: https://github.com/ihebsaidi98
          - text: GitHub
          - generic [ref=e609]: ↗
        - link "LinkedIn" [ref=e610] [cursor=pointer]:
          - /url: https://linkedin.com/in/iheb-saidi-/
          - text: LinkedIn
          - generic [ref=e611]: ↗
      - paragraph [ref=e612]: TUNIS, TN · 18:01:54 · TYPICALLY REPLIES WITHIN 24H
  - contentinfo [ref=e613]:
    - generic [ref=e614]:
      - generic [ref=e615]: © 2026 IHEB SAIDI
      - generic [ref=e616]: TUNIS, TN — 18:01:54
      - button "BACK TO TOP ↑" [ref=e617] [cursor=pointer]
  - alert [ref=e618]
  - generic [ref=e621] [cursor=pointer]:
    - img [ref=e622]
    - generic [ref=e624]: 1 error
    - button "Hide Errors" [ref=e625]:
      - img [ref=e626]
```

# Test source

```ts
  142 |   });
  143 |   console.log(`=== PROBE A: querySelector resolution: ${probeA.totalTargets - probeA.nullCount}/${probeA.totalTargets} found (${probeA.errCount} syntax errors) ===`);
  144 |   console.log(`=== PROBE A: ${probeA.carriers.length} gradient carriers found: ===`);
  145 |   for (const c of probeA.carriers) {
  146 |     console.log(`  CARRIER: ${c.tagClass} => ${c.grad}`);
  147 |   }
  148 |   const carrierAncestors = probeA.carriers.filter((c) => c.ancestorOfIncomplete);
  149 |   console.log(
  150 |     `=== PROBE A: ${carrierAncestors.length} are ancestors of incomplete nodes ===`,
  151 |   );
  152 | 
  153 |   // Write full probe data directly to disk for 100% fidelity without log truncation
  154 |   const fs = await import("fs");
  155 |   fs.writeFileSync(
  156 |     "probe-data.json",
  157 |     JSON.stringify({ byReason, probeA, incompleteCount: incompleteNodes.length }, null, 2),
  158 |   );
  159 | 
  160 |   // ── PROBE B: analyze twice on the same page, compare gradient-incomplete counts ──
  161 |   // If axe caches the pre-strip gradient state, r1 and r2 should differ.
  162 |   // If they are equal, the cache theory is dead.
  163 |   const countGradientIncomplete = (r: Awaited<ReturnType<AxeBuilder["analyze"]>>) =>
  164 |     r.incomplete.flatMap((v) => v.nodes).filter((n) =>
  165 |       n.any.some((c) => c.message?.includes("background gradient")),
  166 |     ).length;
  167 | 
  168 |   await page.waitForTimeout(500);
  169 |   const results2 = await new AxeBuilder({ page })
  170 |     .withTags(["wcag2a", "wcag2aa"])
  171 |     .exclude(".decorative-watermark")
  172 |     .exclude("nextjs-portal")
  173 |     .analyze();
  174 | 
  175 |   const g1 = countGradientIncomplete(results);
  176 |   const g2 = countGradientIncomplete(results2);
  177 |   console.log(`=== PROBE B: g1=${g1}, g2=${g2} ===`);
  178 |   console.log(
  179 |     g1 === g2
  180 |       ? "  → Equal: timing/cache theory DEAD. Same state seen both times."
  181 |       : `  → Different (g1=${g1} vs g2=${g2}): late-injection timing is real.`,
  182 |   );
  183 |   test.info().attach("probe-b", {
  184 |     body: JSON.stringify({ g1, g2, equal: g1 === g2 }),
  185 |     contentType: "application/json",
  186 |   });
  187 | 
  188 |   // ── STEP 2: per-unique-target forensics (limited to 20 to avoid timeout) ──
  189 |   const forensic = await page.evaluate((targets) => {
  190 |     const report: unknown[] = [];
  191 |     for (const sel of targets.slice(0, 20)) {
  192 |       const el = document.querySelector(sel) as HTMLElement | null;
  193 |       if (!el) { report.push({ sel, found: false }); continue; }
  194 |       el.scrollIntoView({ block: "center" });
  195 |       const gradientAncestors: string[] = [];
  196 |       let node: HTMLElement | null = el;
  197 |       while (node) {
  198 |         const bi = getComputedStyle(node).backgroundImage;
  199 |         if (bi !== "none")
  200 |           gradientAncestors.push(
  201 |             `${node.tagName}.${String(node.className).slice(0, 80)} => ${bi.slice(0, 80)}`,
  202 |           );
  203 |         node = node.parentElement;
  204 |       }
  205 |       const r = el.getBoundingClientRect();
  206 |       const chain = new Set<Element>();
  207 |       let a: Element | null = el;
  208 |       while (a) { chain.add(a); a = a.parentElement; }
  209 |       const overlapSuspects = document
  210 |         .elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  211 |         .filter((e) => e !== el && !chain.has(e))
  212 |         .map((e) => `${e.tagName}.${String((e as HTMLElement).className).slice(0, 80)}`);
  213 |       const pseudos: string[] = [];
  214 |       for (const p of ["::before", "::after"] as const) {
  215 |         const cs = getComputedStyle(el, p);
  216 |         if (cs.content !== "none" && cs.backgroundImage !== "none")
  217 |           pseudos.push(`${p}: ${cs.backgroundImage.slice(0, 80)}`);
  218 |       }
  219 |       report.push({ sel, gradientAncestors, overlapSuspects, pseudos });
  220 |     }
  221 |     return report;
  222 |   }, uniqueIncompleteTargets);
  223 |   test.info().attach("step2-forensics", {
  224 |     body: JSON.stringify(forensic, null, 2),
  225 |     contentType: "application/json",
  226 |   });
  227 |   // ── END DIAGNOSTIC ─────────────────────────────────────────────────────────
  228 | 
  229 |   const summary = results.violations.flatMap((v) =>
  230 |     v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")}`),
  231 |   );
  232 | 
  233 |   expect(summary.join("\n")).toBe("");
  234 | 
  235 |   // Unmeasured ≠ passing. Green must mean "everything measurable passed
  236 |   // AND nothing was skipped". Assert incomplete is empty after all
  237 |   // scan-only gradient strips above.
  238 |   const incomplete = results.incomplete.flatMap((v) =>
  239 |     v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`),
  240 |   );
  241 | 
> 242 |   expect(incomplete.join("\n")).toBe("");
      |                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  243 | });
```