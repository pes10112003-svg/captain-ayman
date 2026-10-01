import { headers } from "next/headers";

/**
 * Opening animation, played once per browser session (and on every launch of the installed app).
 * Pure CSS (globals.css → .ca-splash): it ends hidden and never blocks the page afterwards.
 * The tiny inline script runs before the splash is painted and turns it off when it was
 * already shown in this session or the viewer prefers reduced motion.
 *
 * To use the captain's own logo: replace the <svg> below (or the whole mark) with the new
 * artwork — an SVG works as-is; a Lottie file can be swapped in here later.
 */
export async function Splash({ name }: { name: string }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const script =
    "try{var s=sessionStorage;if(s.getItem('ca_splash')||matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.splash='off'}else{s.setItem('ca_splash','1')}}catch(e){document.documentElement.dataset.splash='off'}";
  return (
    <>
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />
      <div className="ca-splash" aria-hidden>
        <div className="ca-splash__inner">
          <div className="ca-splash__mark">
            <span className="ca-splash__ring" />
            <svg viewBox="0 0 32 32">
              <rect width="32" height="32" rx="9" fill="#C4F042" />
              <path
                className="ca-splash__line"
                pathLength={1}
                d="M7 17.5h4.2l2.6-6.5 4.4 11 2.6-6.5H25"
                fill="none"
                stroke="#0B0B0B"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="ca-splash__name">{name}</div>
        </div>
      </div>
    </>
  );
}
