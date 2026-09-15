import React, { useEffect, useRef } from "react";
import { drawDocumentCard } from "../utils/documentArt.js";

export default function DocumentCanvas({ type, label, value, citizenName, width = 280, height = 170 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawDocumentCard(ctx, width, height, { type, label, value, citizenName });
  }, [type, label, value, citizenName, width, height]);

  return <canvas ref={canvasRef} className="document-canvas" />;
}
