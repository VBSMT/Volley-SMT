"use client";

import { useRef, useState } from "react";

/**
 * Roue de cartes : un glissé horizontal fait tourner la sélection autour d'un centre
 * (position fractionnaire pendant le geste, arrondie au relâché). `step` = pixels par carte.
 * `onTap(i)` reçoit la carte touchée sans glissé ; un glissé vers le haut depuis la carte
 * centrale appelle `onLift` (glisser-déposer).
 */
export function useWheel(count: number, step: number, opts: { onTap?: (i: number) => void; onLift?: (e: React.PointerEvent, phase: "move" | "end") => void } = {}) {
  const [center, setCenter] = useState(0);
  const [dragging, setDragging] = useState(false);
  const g = useRef<{ x: number; y: number; from: number; mode: "none" | "spin" | "lift"; index: number } | null>(null);
  const clamp = (v: number) => Math.max(0, Math.min(count - 1, v));

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    g.current = { x: e.clientX, y: e.clientY, from: center, mode: "none", index };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.mode === "none" && Math.hypot(dx, dy) > 8) {
      s.mode = opts.onLift && dy < -Math.abs(dx) && s.index === Math.round(center) ? "lift" : "spin";
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      if (s.mode === "spin") setDragging(true);
    }
    if (s.mode === "spin") setCenter(clamp(s.from - dx / step));
    if (s.mode === "lift") opts.onLift?.(e, "move");
  };
  const end = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    setDragging(false);
    if (!s) return;
    if (s.mode === "spin") setCenter((c) => Math.round(c));
    else if (s.mode === "lift") opts.onLift?.(e, "move");
    else opts.onTap?.(s.index);
  };
  return {
    center,
    setCenter: (i: number) => setCenter(clamp(i)),
    dragging,
    handlers: { onPointerMove, onPointerUp: end, onPointerCancel: end },
    onPointerDown,
  };
}
