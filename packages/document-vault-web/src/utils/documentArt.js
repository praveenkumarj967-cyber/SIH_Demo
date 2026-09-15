// Canvas-based renderer that draws a document-type-specific "ID card" look,
// used both for on-screen preview and for the downloadable PNG export.

const THEMES = {
  AADHAR: {
    title: "GOVERNMENT OF INDIA",
    subtitle: "Unique Identification Authority of India",
    numberLabel: "AADHAR NUMBER",
    bg: ["#ffffff", "#e8f2ff"],
    stripe: ["#FF9933", "#FFFFFF", "#128807"],
    accent: "#1d4ed8",
    emblem: "🇮🇳",
  },
  PAN: {
    title: "INCOME TAX DEPARTMENT",
    subtitle: "GOVT. OF INDIA \u2014 Permanent Account Number",
    numberLabel: "PAN",
    bg: ["#fdf8ec", "#fbeccb"],
    stripe: null,
    accent: "#92400e",
    emblem: "🧾",
  },
  DRIVING_LICENSE: {
    title: "DRIVING LICENCE",
    subtitle: "Regional Transport Office",
    numberLabel: "DL NUMBER",
    bg: ["#eef6ff", "#dbeafe"],
    stripe: null,
    accent: "#0369a1",
    emblem: "🚗",
  },
  MARKSHEET: {
    title: "STATEMENT OF MARKS",
    subtitle: "Board of Secondary Education",
    numberLabel: "ROLL NO / CERT ID",
    bg: ["#fffdf6", "#fdf0cf"],
    stripe: null,
    accent: "#7c2d12",
    emblem: "🎓",
  },
};

const DEFAULT_THEME = {
  title: "IDENTITY DOCUMENT",
  subtitle: "Government of Bharat",
  numberLabel: "DOCUMENT NUMBER",
  bg: ["#f8fafc", "#e2e8f0"],
  stripe: null,
  accent: "#334155",
  emblem: "📄",
};

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawFakeQr(ctx, x, y, size) {
  const cells = 7;
  const cell = size / cells;
  ctx.fillStyle = "#0f172a";
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      if ((i * 31 + j * 17) % 5 < 2) {
        ctx.fillRect(x + i * cell, y + j * cell, cell - 1, cell - 1);
      }
    }
  }
}

export function drawDocumentCard(ctx, width, height, { type, label, value, citizenName }) {
  const theme = THEMES[type] || DEFAULT_THEME;
  ctx.clearRect(0, 0, width, height);

  roundRect(ctx, 0, 0, width, height, 18);
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, theme.bg[0]);
  grad.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.save();
  ctx.clip();

  const stripeH = 7;
  if (theme.stripe) {
    theme.stripe.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, i * stripeH, width, stripeH);
    });
  }

  const topPad = (theme.stripe ? theme.stripe.length * stripeH : 0) + 16;

  ctx.fillStyle = theme.accent;
  ctx.font = "700 14px Sora, Arial, sans-serif";
  ctx.fillText(theme.title, 18, topPad);
  ctx.fillStyle = "#475569";
  ctx.font = "500 9px Inter, Arial, sans-serif";
  ctx.fillText(theme.subtitle, 18, topPad + 14);

  ctx.font = "24px serif";
  ctx.textAlign = "right";
  ctx.fillText(theme.emblem, width - 18, topPad + 8);
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(15,23,42,0.15)";
  ctx.beginPath();
  ctx.moveTo(18, topPad + 24);
  ctx.lineTo(width - 18, topPad + 24);
  ctx.stroke();

  const photoX = 18;
  const photoY = topPad + 36;
  const photoW = 64;
  const photoH = 78;
  roundRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.fillStyle = "rgba(15,23,42,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.2)";
  ctx.stroke();
  ctx.font = "30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(15,23,42,0.35)";
  ctx.fillText("\uD83D\uDC64", photoX + photoW / 2, photoY + photoH / 2 + 10);
  ctx.textAlign = "left";

  const infoX = photoX + photoW + 16;
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 14px Inter, Arial, sans-serif";
  ctx.fillText((citizenName || "CITIZEN NAME").toUpperCase(), infoX, photoY + 16);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 9px Inter, Arial, sans-serif";
  ctx.fillText(theme.numberLabel, infoX, photoY + 36);

  ctx.fillStyle = theme.accent;
  ctx.font = "700 16px 'JetBrains Mono', monospace";
  ctx.fillText(value || label || "", infoX, photoY + 56);

  ctx.fillStyle = "rgba(15,23,42,0.5)";
  ctx.font = "500 8px Inter, Arial, sans-serif";
  ctx.fillText("Issued via GovStack DigiVault \u2014 demo document", 18, height - 14);

  drawFakeQr(ctx, width - 58, height - 58, 40);

  ctx.restore();

  roundRect(ctx, 0, 0, width, height, 18);
  ctx.strokeStyle = "rgba(15,23,42,0.14)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function renderDocumentDataUrl(doc, { scale = 2, width = 320, height = 194 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  drawDocumentCard(ctx, width, height, doc);
  return canvas.toDataURL("image/png");
}

export function downloadDocumentImage(doc) {
  const dataUrl = renderDocumentDataUrl(doc);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${(doc.label || doc.type || "document").replace(/\s+/g, "_")}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
