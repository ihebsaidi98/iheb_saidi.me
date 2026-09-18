import { ImageResponse } from "next/og";
import { profile } from "@/data/profile";

export const runtime = "edge";
export const alt = "Iheb Saidi — Full Stack Software Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#04070c",
          color: "#fff",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 22,
            letterSpacing: 4,
            color: "#6ee7b7",
            marginBottom: 24,
          }}
        >
          AVAILABLE FOR NEW OPPORTUNITIES
        </div>
        <div style={{ fontSize: 110, letterSpacing: -4, lineHeight: 1 }}>
          {profile.name}.
        </div>
        <div
          style={{
            marginTop: 32,
            fontFamily: "monospace",
            fontSize: 28,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {profile.title}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 48 }}>
          {["Java 21", "Spring Boot", "Angular", "TypeScript"].map((s) => (
            <div
              key={s}
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 999,
                padding: "8px 20px",
                fontFamily: "monospace",
                fontSize: 20,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}