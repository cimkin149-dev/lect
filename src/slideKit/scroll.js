// Decides whether (and where) to scroll so a block that is being discussed stays
// comfortably in view. Returns the new scrollTop, or null when the block is
// already well placed or the move would be negligible, so the page doesn't
// jitter. The sticky title (headerH) is accounted for.
export function scrollTopForBlock({ blockTop, blockBottom, scrollTop, viewHeight, headerH = 0, scrollHeight }) {
  const maxScroll = Math.max(0, scrollHeight - viewHeight);
  if (maxScroll < 4) return null;
  const safeTop = scrollTop + headerH + viewHeight * 0.04;
  const safeBottom = scrollTop + viewHeight * 0.82;
  if (blockTop >= safeTop && blockBottom <= safeBottom) return null; // already comfortably visible
  const height = blockBottom - blockTop;
  // Put the block about a fifth of the way down (below the title) so there's context above and what comes next below.
  let target = height > viewHeight * 0.6 ? blockTop - headerH - 12 : blockTop - headerH - viewHeight * 0.18;
  target = Math.round(Math.min(maxScroll, Math.max(0, target)));
  return Math.abs(target - scrollTop) < 8 ? null : target;
}
