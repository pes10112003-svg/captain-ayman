import { headers } from "next/headers";
import { AYMAN_PATHS, CAPTAIN_PATHS } from "./logo-paths";

/**
 * Opening animation: the Captain Ayman logo is traced letter by letter while a spark of energy
 * rides the tip of every line and lightning crackles around it; the logo fills, gets a light sweep,
 * a charge of light, then disappears — and "Welcome to my family" appears on its own before the page.
 * Plays once per browser session (and on every launch of the app). Pure CSS (globals.css →
 * .ca-splash); it ends hidden and never blocks the page afterwards. The inline script runs before
 * the splash is painted and switches it off when it was already shown in this session or the
 * viewer prefers reduced motion.
 */

/** Jagged lightning bolts around the logo (fixed seed → the same bolts on server and client). */
const BOLTS = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const line = (pts: number[][]) => "M" + pts.map((p) => p.map((v) => v.toFixed(0)).join(" ")).join(" L");
  const bolt = (x1: number, y1: number, x2: number, y2: number, segs = 9, amp = 70) => {
    const pts = [[x1, y1]];
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.hypot(nx, ny);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const off = (rnd() - 0.5) * 2 * amp;
      pts.push([x1 + (x2 - x1) * t + (nx / len) * off, y1 + (y2 - y1) * t + (ny / len) * off]);
    }
    pts.push([x2, y2]);
    const [bx, by] = pts[3 + Math.floor(rnd() * 3)]!;
    const branch = [
      [bx!, by!],
      [bx! + (rnd() - 0.3) * 160, by! + (rnd() + 0.2) * 120],
      [bx! + (rnd() - 0.2) * 260, by! + (rnd() + 0.4) * 200],
    ];
    return [line(pts), line(branch)];
  };
  return [
    { paths: bolt(-40, 260, 300, 560), at: 280 },
    { paths: bolt(1690, 80, 1380, 420), at: 620 },
    { paths: bolt(560, 1330, 900, 1080, 8, 60), at: 900 },
    { paths: bolt(1180, -50, 1500, 240, 7, 55), at: 1120 },
  ];
})();

const Spark = ({ d, i, kind }: { d: string; i: number; kind: "b" | "s" }) => (
  <g className={`ca-spark ca-spark-${kind}`} style={{ ["--i" as string]: i }}>
    <path className="g1" pathLength={1} d={d} />
    <path className="g2" pathLength={1} d={d} />
    <path className="g3" pathLength={1} d={d} />
  </g>
);

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
          {BOLTS.map((b, i) => (
            <g key={`z${i}`} className="ca-bolt" style={{ ["--t" as string]: `${b.at}ms` }}>
              {b.paths.map((d, j) => (
                <g key={j}>
                  <path className="z1" d={d} />
                  <path className="z2" d={d} />
                  <path className="z3" d={d} />
                </g>
              ))}
            </g>
          ))}
          {CAPTAIN_PATHS.map((d, i) => (
            <path key={`s${i}`} className="ca-s" pathLength={1} style={{ ["--i" as string]: i }} d={d} />
          ))}
          {AYMAN_PATHS.map((d, i) => (
            <path key={`b${i}`} className="ca-b" pathLength={1} style={{ ["--i" as string]: i }} d={d} />
          ))}
          {CAPTAIN_PATHS.map((d, i) => (
            <Spark key={`ss${i}`} d={d} i={i} kind="s" />
          ))}
          {AYMAN_PATHS.map((d, i) => (
            <Spark key={`sb${i}`} d={d} i={i} kind="b" />
          ))}
          <g clipPath="url(#ca-logo-clip)">
            <rect className="ca-sweep" x="-600" y="-60" width="420" height="1407" fill="url(#ca-sweep)" />
          </g>
        </svg>
        <p className="ca-splash__welcome" dir="ltr">
          Welcome to my <span>family</span>
        </p>
      </div>
    </>
  );
}
