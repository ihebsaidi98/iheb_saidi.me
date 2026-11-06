/**
 * Ambient module declaration for SVG imports.
 *
 * `next.config.mjs` replaces Next's default file-loader rule for `.svg` with
 * `@svgr/webpack` (except for `*.svg?url`), so an SVG import yields a React
 * component — which is how `src/sections/Hero.tsx` uses it (`<ArrowDown />`).
 *
 * TypeScript needs to be told that. Next ships such a declaration in
 * `next/image-types/global.d.ts`, but it only reaches the compiler through
 * `next-env.d.ts`, a file this repository generates and gitignores. A fresh CI
 * checkout therefore has no `declare module "*.svg"` at all at the `tsc` step,
 * which runs before `next build` regenerates that file, and `tsc` fails with
 * TS2307 on the import. This tracked file makes the declaration independent of
 * the generated file.
 *
 * Keep it tracked; do not move it back into next-env.d.ts.
 */
declare module "*.svg" {
  import type { FC, SVGProps } from "react";

  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
