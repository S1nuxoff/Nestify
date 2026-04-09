// src/components/movie/MovieBackground.jsx
import React, { useRef, useEffect } from "react";
import "../../styles/MoviePage.css";

let supportsCanvasBlurCache = null;

function supportsCanvasBlur() {
  if (supportsCanvasBlurCache !== null) return supportsCanvasBlurCache;

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.filter === "undefined") {
      supportsCanvasBlurCache = false;
      return supportsCanvasBlurCache;
    }

    ctx.filter = "blur(10px)";
    supportsCanvasBlurCache = ctx.filter === "blur(10px)";
    return supportsCanvasBlurCache;
  } catch (e) {
    supportsCanvasBlurCache = false;
    return supportsCanvasBlurCache;
  }
}

const MovieBackground = ({ image }) => {
  const backgroundCanvasRef = useRef(null);
  const scrollFactorRef = useRef(0); // 0..1 — затемнение при скролле

  useEffect(() => {
    if (!image) return;
    if (!supportsCanvasBlur()) return;

    const canvas = backgroundCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const img = new Image();
    img.src = image;

    const getViewportWidth = () =>
      Math.max(
        document.documentElement.clientWidth || 0,
        window.innerWidth || 0
      );

    const render = () => {
      if (cancelled || !img.complete || !img.naturalWidth) return;

      const cw = (canvas.width = getViewportWidth());
      const ch = (canvas.height =
        window.innerHeight || document.documentElement.clientHeight || 0);

      const BLUR_STRONG = 20;
      const BLUR_SOFT = 1;

      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(cw / iw, ch / ih);
      const w = iw * scale;
      const h = ih * scale;
      const x = (cw - w) / 2;
      const y = (ch - h) / 2;

      const t = scrollFactorRef.current || 0;

      ctx.clearRect(0, 0, cw, ch);

      // 1) сильный blur
      ctx.filter = `blur(${BLUR_STRONG}px)`;
      ctx.drawImage(img, x, y, w, h);
      ctx.filter = "none";

      // 2) мягкий blur оффскрин
      const off = document.createElement("canvas");
      off.width = cw;
      off.height = ch;
      const octx = off.getContext("2d");

      octx.filter = `blur(${BLUR_SOFT}px)`;
      octx.drawImage(img, x, y, w, h);
      octx.filter = "none";

      // 3) маска для правой части
      octx.globalCompositeOperation = "destination-in";
      const blurGrad = octx.createLinearGradient(0, 0, cw, 0);
      blurGrad.addColorStop(0.0, "rgba(0,0,0,0)");
      blurGrad.addColorStop(0.3, "rgba(0,0,0,0.2)");
      blurGrad.addColorStop(0.6, "rgba(0,0,0,0.7)");
      blurGrad.addColorStop(1.0, "rgba(0,0,0,1)");
      octx.fillStyle = blurGrad;
      octx.fillRect(0, 0, cw, ch);
      octx.globalCompositeOperation = "source-over";

      ctx.drawImage(off, 0, 0);

      // 4) затемнение справа
      const baseLeft = 0.0;
      const baseMid1 = 0.25;
      const baseMid2 = 0.65;
      const baseRight = 0.9;
      const extra = (v) => Math.min(1, v + 0.4 * t);

      const grad = ctx.createLinearGradient(0, 0, cw, 0);
      grad.addColorStop(0, `rgba(0,0,0,${extra(baseLeft)})`);
      grad.addColorStop(0.4, `rgba(0,0,0,${extra(baseMid1)})`);
      grad.addColorStop(0.75, `rgba(0,0,0,${extra(baseMid2)})`);
      grad.addColorStop(1, `rgba(0,0,0,${extra(baseRight)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      // 5) засвет слева
      const glowStrength = 0.24 * (1 - 0.6 * t);
      const radial = ctx.createRadialGradient(
        cw * 0.25,
        ch * 0.4,
        0,
        cw * 0.25,
        ch * 0.4,
        cw * 0.8
      );
      radial.addColorStop(0, `rgba(255,255,255,${glowStrength})`);
      radial.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, cw, ch);

      canvas.classList.add("movie-page__background-canvas--visible");
    };

    const handleScroll = () => {
      const maxScroll = 600;
      const raw = Math.min(window.scrollY / maxScroll, 1);
      const t = 1 - Math.pow(1 - raw, 3); // easeOutCubic
      scrollFactorRef.current = t;
      render();
    };

    const onLoad = () => {
      if (cancelled) return;
      render();
      window.addEventListener("resize", render);
      window.addEventListener("scroll", handleScroll);
    };

    if (img.complete && img.naturalWidth) {
      onLoad();
    } else {
      img.onload = onLoad;
    }

    return () => {
      cancelled = true;
      window.removeEventListener("resize", render);
      window.removeEventListener("scroll", handleScroll);
      canvas.classList.remove("movie-page__background-canvas--visible");
    };
  }, [image]);

  if (!image) return null;

  return (
    <>
      <canvas
        ref={backgroundCanvasRef}
        className="movie-page__background-canvas"
      />
      <div
        className="movie-page__background-mobile"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="movie-page__overlay" />
    </>
  );
};

export default MovieBackground;
