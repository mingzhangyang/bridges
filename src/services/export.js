// The caller renders the scene with or without the route; this only rasterizes it.
export async function postcardBlob(svg, { title, subtitle }) {
  const clone = svg.cloneNode(true);
  clone.querySelectorAll('.bridge-hit,.node-hit,.traveler,.degree').forEach((n) => n.remove());
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent =
    '.bridge-shadow{fill:none;stroke:#406c7b;stroke-width:21;opacity:.15}.bridge-rail{fill:none;stroke:#796f57;stroke-width:18}.bridge-deck{fill:none;stroke-width:13}.bridge-grain{fill:none;stroke:#f1e2c5;stroke-width:1;stroke-dasharray:2 7}.node-dot{fill:#eae6d7;stroke:#697f78;stroke-width:2}.node-letter{font:15px sans-serif;fill:#344e52}.land-name{font:14px sans-serif;fill:#344e52}.graph-view .terrain{opacity:.1}.slot-label{font:20px sans-serif}';
  clone.prepend(style);
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }),
  );
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f1e7';
    ctx.fillRect(0, 0, 1400, 1100);
    ctx.fillStyle = '#314a4d';
    ctx.font = '38px serif';
    ctx.fillText(title, 75, 78);
    ctx.font = '20px sans-serif';
    ctx.fillText(subtitle, 75, 120);
    const box = svg.viewBox.baseVal,
      scale = Math.min(1250 / box.width, 830 / box.height);
    ctx.drawImage(img, (1400 - box.width * scale) / 2, 165, box.width * scale, box.height * scale);
    ctx.font = '16px sans-serif';
    ctx.fillText('SEVEN BRIDGES  ·  A CITY, ONE JOURNEY', 75, 1050);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function downloadBlob(blob, filename) {
  const a = document.createElement('a'),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
