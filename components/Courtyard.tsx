// Decorative line drawing of an aangan (courtyard): arched colonnade, central planter, low sun.
// Fine strokes in sand and sage so it reads as texture, not as a block of colour. aria-hidden.
export function Courtyard({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const arches = [0, 1, 2, 3, 4];
  if (tone === "dark") return <CourtyardLines className={className} line="rgb(255 255 255 / 0.22)" soft="rgb(255 255 255 / 0.12)" plant="rgb(217 201 174 / 0.55)" sun="rgb(217 201 174 / 0.28)" />;
  return (
    <svg aria-hidden viewBox="0 0 420 260" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* sun */}
      <circle cx="318" cy="70" r="34" fill="#efdcc0" opacity="0.75" />
      <circle cx="318" cy="70" r="48" stroke="#d5bd94" strokeOpacity="0.45" strokeWidth="1" />
      {/* back wall + colonnade */}
      <path d="M20 214 H400" stroke="#b9a782" strokeWidth="1.2" />
      <path d="M40 214 V112 H380 V214" stroke="#b9a782" strokeWidth="1.2" />
      <path d="M32 112 H388" stroke="#b9a782" strokeWidth="1.2" />
      <path d="M26 104 H394" stroke="#b9a782" strokeOpacity="0.6" strokeWidth="1" />
      {arches.map((i) => {
        const x = 52 + i * 66;
        return (
          <g key={i}>
            <path d={`M${x} 214 V158 a27 27 0 0 1 54 0 V214`} stroke="#b9a782" strokeWidth="1.2" />
            <path d={`M${x + 8} 214 V162 a19 19 0 0 1 38 0 V214`} stroke="#d5bd94" strokeOpacity="0.55" strokeWidth="1" />
          </g>
        );
      })}
      {/* floor tiles */}
      <path d="M60 232 H360 M90 248 H330" stroke="#d5bd94" strokeOpacity="0.6" strokeWidth="1" />
      {/* tulsi planter with a small tree */}
      <path d="M190 214 h40 l-5 -20 h-30 z" stroke="#7c8b72" strokeWidth="1.3" fill="#f6f1e8" />
      <path d="M210 194 V150" stroke="#7c8b72" strokeWidth="1.3" />
      <path d="M210 168 c-14 -4 -22 -14 -22 -26 c12 2 20 10 22 26 z M210 160 c12 -4 20 -14 20 -26 c-11 3 -18 11 -20 26 z M210 178 c-10 -2 -17 -8 -19 -16 c9 0 16 6 19 16 z" stroke="#7c8b72" strokeWidth="1.2" fill="#e8ebe1" />
    </svg>
  );
}

/** Line-only courtyard for dark (forest) panels. */
function CourtyardLines({ className, line, soft, plant, sun }: { className: string; line: string; soft: string; plant: string; sun: string }) {
  return (
    <svg aria-hidden viewBox="0 0 420 260" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="318" cy="70" r="34" fill={sun} />
      <circle cx="318" cy="70" r="48" stroke={soft} strokeWidth="1" />
      <path d="M20 214 H400 M40 214 V112 H380 V214 M32 112 H388" stroke={line} strokeWidth="1.2" />
      <path d="M26 104 H394" stroke={soft} strokeWidth="1" />
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 52 + i * 66;
        return <path key={i} d={`M${x} 214 V158 a27 27 0 0 1 54 0 V214`} stroke={line} strokeWidth="1.2" />;
      })}
      <path d="M190 214 h40 l-5 -20 h-30 z M210 194 V150" stroke={plant} strokeWidth="1.3" />
      <path d="M210 168 c-14 -4 -22 -14 -22 -26 c12 2 20 10 22 26 z M210 160 c12 -4 20 -14 20 -26 c-11 3 -18 11 -20 26 z" stroke={plant} strokeWidth="1.2" />
    </svg>
  );
}
