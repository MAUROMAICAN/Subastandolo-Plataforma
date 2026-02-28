import logoUrl from "@/assets/logo.png";

/**
 * Adds a subtle diagonal watermark using the Subastandolo logo.
 * Returns a new File with the watermark applied.
 */
export async function applyWatermark(file: File): Promise<File> {
  const [img, logo] = await Promise.all([loadImageFromFile(file), loadImageFromUrl(logoUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;

  // Draw original image
  ctx.drawImage(img, 0, 0);

  // Logo watermark settings
  const logoHeight = Math.max(20, canvas.height * 0.06);
  const logoWidth = logoHeight * (logo.width / logo.height);
  const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);

  // Tiled diagonal pattern
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);

  const spacingX = logoWidth * 3.5;
  const spacingY = logoHeight * 5;
  const repeatsX = Math.ceil(diagonal / spacingX) + 2;
  const repeatsY = Math.ceil(diagonal / spacingY) + 2;

  for (let row = -repeatsY; row <= repeatsY; row++) {
    for (let col = -repeatsX; col <= repeatsX; col++) {
      const x = col * spacingX + (row % 2 === 0 ? 0 : spacingX / 2) - logoWidth / 2;
      const y = row * spacingY - logoHeight / 2;
      ctx.drawImage(logo, x, y, logoWidth, logoHeight);
    }
  }
  ctx.restore();

  // Corner logo (slightly more visible)
  ctx.save();
  const cornerH = Math.max(16, canvas.height * 0.05);
  const cornerW = cornerH * (logo.width / logo.height);
  ctx.globalAlpha = 0.28;
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 4;
  ctx.drawImage(logo, canvas.width - cornerW - 12, canvas.height - cornerH - 10, cornerW, cornerH);
  ctx.restore();

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/webp", 0.92)
  );

  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
