import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles/print.css"), "utf8");

describe("geometría PDF A4", () => {
  it("define un lienzo A4 sin margen externo", () => {
    expect(css).toContain("size: A4 portrait");
    expect(css).toMatch(/@page\s*\{[\s\S]*?margin:\s*0;/);
  });

  it("no utiliza compensaciones que provoquen escalado", () => {
    expect(css).not.toMatch(/margin:\s*-\d/);
    expect(css).not.toMatch(/transform:\s*scale/);
  });

  it("mantiene las cubiertas y páginas interiores en 210 × 297 mm", () => {
    expect(css).toContain("width: 210mm !important");
    expect(css).toContain("height: 297mm !important");
    expect(css).toContain("padding: 18mm 17mm 20mm 22mm !important");
  });

  it("fuerza la reproducción exacta del color", () => {
    expect(css).toContain("-webkit-print-color-adjust: exact");
    expect(css).toContain("background: var(--unit-color) !important");
  });

  it("mantiene imágenes, vídeos y adjuntos dentro del ancho imprimible", () => {
    expect(css).toMatch(/video,[\s\S]*?max-width:\s*100%\s*!important/);
    expect(css).toContain(".student-material img");
    expect(css).toContain(".video-thumbnail");
    expect(css).toContain("max-height: 225mm !important");
  });
});
