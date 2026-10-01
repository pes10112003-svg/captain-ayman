import { headers } from "next/headers";
import { AYMAN_PATHS, CAPTAIN_PATHS } from "./logo-paths";

/**
 * Opening animation (the "draw" version the team picked): the Captain Ayman logo is traced
 * letter by letter, fills in, gets a light sweep, then fades into the page.
 * Plays once per browser session (and on every launch of the installed app). Pure CSS
 * (globals.css → .ca-splash); it ends hidden and never blocks the page afterwards.
 * The inline script runs before the splash is painted and switches it off when it was
 * already shown in this session or the viewer prefers reduced motion.
 */
export async function Splash() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const script =
    "try{var s=sessionStorage;if(s.getItem('ca_splash')||matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.dataset.splash='off'}else{s.setItem('ca_splash','1')}}catch(e){document.documentElement.dataset.splash='off'}";
  return (
    <>
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />
      <div className="ca-splash" aria-hidden>
        <svg viewBox="-60 -60 1742 1407" className="ca-splash__logo">
          <defs>
            <linearGradient id="ca-sweep" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="ca-logo-clip">
              {[...AYMAN_PATHS, ...CAPTAIN_PATHS].map((d, i) => (
                <path key={i} d={d} />
              ))}
            </clipPath>
          </defs>
          {CAPTAIN_PATHS.map((d, i) => (
            <path key={`s${i}`} className="ca-s" pathLength={1} style={{ ["--i" as string]: i }} d={d} />
          ))}
          {AYMAN_PATHS.map((d, i) => (
            <path key={`b${i}`} className="ca-b" pathLength={1} style={{ ["--i" as string]: i }} d={d} />
          ))}
          <g clipPath="url(#ca-logo-clip)">
            <rect className="ca-sweep" x="-600" y="-60" width="420" height="1407" fill="url(#ca-sweep)" />
          </g>
        </svg>
      </div>
    </>
  );
}
