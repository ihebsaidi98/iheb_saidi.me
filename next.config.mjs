/** @type {import('next').NextConfig} */
import nextBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // AUD-06: the enforced CSP is built for each request in
          // src/middleware.ts (see src/lib/csp.ts), because a nonce must change
          // on every response and this header set is evaluated once and frozen
          // into the build manifest. Emitting a second policy here would be
          // intersected with the enforced one and silently re-allow inline
          // scripts. The Reporting API endpoint keeps its static declaration:
          // it carries no per-request value.
          {
            key: "Reporting-Endpoints",
            value: 'csp-endpoint="/api/csp-report"',
          },
        ],
      },
    ];
  },

  webpack(config, { nextRuntime, webpack }) {
    // H3-3 / H3-4: src/instrumentation.ts is compiled for both runtimes because
    // src/app/opengraph-image.tsx is an Edge route. The proxy validators are
    // Node-only, so the Edge compilation resolves them to an empty module.
    // register() already bails out there; this keeps the code out of the Edge
    // bundle instead of merely unreachable — Next.js 15.5.28 otherwise inlines
    // the dynamic import into edge-instrumentation.js.
    //
    // IgnorePlugin rather than resolve.alias: `@/lib/env-config` is resolved by
    // Next's jsconfig-paths plugin before webpack's alias step, so an alias on
    // that specifier has no effect (measured on 15.5.28).
    if (nextRuntime === "edge") {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /[\\/]lib[\\/]env-config(\.[cm]?[jt]sx?)?$/,
        }),
      );
    }

    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg")
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: {
          loader: "@svgr/webpack",
          options: {
            svgoConfig: {
              plugins: [
                {
                  name: "preset-default",
                  params: {
                    overrides: {
                      removeViewBox: false,
                    },
                  },
                },
              ],
            },
          },
        },
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);
