import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#04070c] px-6 text-white">
      <div className="w-full max-w-lg">
        <p className="font-mono text-xs text-emerald-300/80">$ curl https://iheb.dev/this-page</p>
        <h1 className="mt-4 font-serif text-6xl tracking-[-0.04em]">404</h1>
        <p className="mt-4 font-mono text-sm leading-7 text-white/50">
          <span className="text-white/80">HTTP/1.1 404 Not Found</span>
          <br />
          The route you requested was never deployed.
          <br />
          Everything that exists is one click away:
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/"
            className="rounded-full border border-emerald-200/25 bg-emerald-300/[0.08] px-5 py-2.5 text-xs font-semibold transition-colors hover:bg-emerald-300/[0.14]"
          >
            $ cd /home
          </Link>
          <Link
            href="/#projects"
            className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold text-white/70 transition-colors hover:border-white/30"
          >
            $ ls ./projects
          </Link>
        </div>
      </div>
    </main>
  );
}