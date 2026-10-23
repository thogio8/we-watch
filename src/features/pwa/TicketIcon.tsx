import { ImageResponse } from "next/og";
import { BRAND } from "./brand";

/** A heavy block « W » drawn as a polygon (no font file needed), 100 × 80 box. */
const W_POINTS =
  "0,0 22,0 30,46 40,0 60,0 70,46 78,0 100,0 84,80 62,80 50,34 38,80 16,80";

interface TicketIconOptions {
  /** Edge of the square PNG, in px. */
  size: number;
  /**
   * Maskable icons are cropped by the OS to a circle or squircle: keep the
   * ticket inside the central safe zone (80 % circle).
   */
  maskable?: boolean;
}

/**
 * The riso ticket of the « Ticket d'entrée » direction: pink ticket, ink
 * outline, blue offset shadow, punched notches and « WW », on cream paper.
 */
export function ticketIcon({ size, maskable = false }: TicketIconOptions) {
  const scale = maskable ? 0.72 : 1;
  const width = Math.round(size * 0.78 * scale);
  const height = Math.round(size * 0.56 * scale);
  // Thick, readable outline at every size (the 3px border of a 290 px mockup).
  const border = Math.max(2, Math.round(size * 0.04 * scale));
  const shadow = Math.max(2, Math.round(size * 0.06 * scale));
  const notch = Math.round(height * 0.32);
  const letterWidth = Math.round(width * 0.3);
  const letterHeight = Math.round(letterWidth * 0.8);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: BRAND.paper,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          // Clips the notches to half circles punched into the edges.
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(width * 0.02),
          width,
          height,
          // Nudged up-left so ticket + offset shadow stay centred.
          marginTop: -shadow,
          marginLeft: -shadow,
          border: `${border}px solid ${BRAND.ink}`,
          borderRadius: Math.round(height * 0.16),
          background: BRAND.pink,
          boxShadow: `${shadow}px ${shadow}px 0 ${BRAND.blue}`,
        }}
      >
        {[0, 1].map((index) => (
          <svg
            key={index}
            width={letterWidth}
            height={letterHeight}
            viewBox="0 0 100 80"
          >
            <polygon points={W_POINTS} fill={BRAND.ink} />
          </svg>
        ))}
        {[{ left: -notch / 2 }, { right: -notch / 2 }].map((side, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              top: (height - notch) / 2 - border,
              ...side,
              width: notch,
              height: notch,
              border: `${border}px solid ${BRAND.ink}`,
              borderRadius: "50%",
              background: BRAND.paper,
            }}
          />
        ))}
      </div>
    </div>,
    { width: size, height: size },
  );
}
