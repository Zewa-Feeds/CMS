"use client";

import { useCallback, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Film, ImageIcon } from "lucide-react";

/**
 * Full-size viewer for a product's gallery.
 *
 * Deliberately NOT built on <Modal>: that is a card with a fixed header and a
 * 460px cap, which crops a 1080p photo to a stamp. Media wants the whole viewport
 * and a dark surround so the asset is the only thing you look at.
 *
 * Behaviour matches the rest of the CMS: click the scrim or press Escape to
 * close. Arrow keys move through the gallery, because someone checking uploads
 * wants to flick through them rather than close and reopen.
 */
export function MediaLightbox({ media, index, onClose, onIndexChange }) {
  const count = media?.length ?? 0;
  const item = count > 0 ? media[index] : null;

  const go = useCallback(
    (delta) => {
      if (count < 2) return;
      // Wrap, so the arrows never dead-end.
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling under the viewer.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose, go]);

  if (!item) return null;

  const isVideo = item.type === "VIDEO";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-navy/95 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? "Product video" : "Product image"}
    >
      {/* Top bar: what you are looking at, and the way out. */}
      <div className="flex shrink-0 items-center gap-3 pb-3 text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] font-medium">
          {isVideo ? <Film size={12} /> : <ImageIcon size={12} />}
          {isVideo ? "Video" : "Photo"}
          {count > 1 && (
            <span className="ml-1 tabular-nums text-white/60">
              {index + 1}/{count}
            </span>
          )}
        </span>

        {item.width && item.height && (
          <span className="text-[11.5px] tabular-nums text-white/55">
            {item.width}×{item.height}
            {isVideo && item.durationSec ? ` · ${Math.round(item.durationSec)}s` : ""}
          </span>
        )}

        {item.alt ? (
          <span className="truncate text-[12px] text-white/70">{item.alt}</span>
        ) : null}

        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto shrink-0 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/12 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Stage. min-h-0 lets the flex child actually shrink so tall media fits. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center gap-2"
        onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      >
        {count > 1 && (
          <NavButton dir="prev" onClick={() => go(-1)} />
        )}

        {isVideo ? (
          <video
            key={item.url}
            // React does not reflect `muted` to the DOM attribute; set it on the
            // element or the video starts with sound.
            ref={(el) => {
              if (el) el.muted = true;
            }}
            src={item.url}
            poster={item.posterUrl ?? undefined}
            controls
            playsInline
            className="max-h-full max-w-full rounded-lg bg-black shadow-pop"
          />
        ) : (
          /*
           * Plain <img>, not next/image: this is a full-size inspection view, so
           * an optimised-and-resized version would defeat the purpose. The asset
           * is already served from Cloudinary's CDN.
           */
          <img
            src={item.url}
            alt={item.alt || "Product image"}
            className="max-h-full max-w-full rounded-lg object-contain shadow-pop"
          />
        )}

        {count > 1 && <NavButton dir="next" onClick={() => go(1)} />}
      </div>

      {/* Filmstrip, so you can jump straight to an item. */}
      {count > 1 && (
        <div className="mt-3 flex shrink-0 justify-center gap-2 overflow-x-auto pb-1">
          {media.map((m, i) => (
            <button
              key={m.url + i}
              onClick={() => onIndexChange(i)}
              aria-label={`View item ${i + 1}`}
              aria-current={i === index}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                i === index ? "border-teal" : "border-white/15 hover:border-white/40"
              }`}
            >
              <img
                src={m.type === "VIDEO" ? (m.posterUrl ?? m.url) : m.url}
                alt=""
                className="h-full w-full object-cover"
              />
              {m.type === "VIDEO" && (
                <span className="absolute inset-0 grid place-items-center bg-navy/45 text-white">
                  <Film size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="mt-1 shrink-0 text-center text-[11px] text-white/40">
        {count > 1 ? "Arrow keys to move · " : ""}Esc to close
      </p>
    </div>
  );
}

function NavButton({ dir, onClick }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous" : "Next"}
      className="shrink-0 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
    >
      <Icon size={22} />
    </button>
  );
}
