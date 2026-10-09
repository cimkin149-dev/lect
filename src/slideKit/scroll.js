// Where should the slide area be scrolled to while the lecturer is on spoken
// unit `i` of `n`? Progress through the narration maps linearly onto the
// scrollable distance: the first unit shows the top (title included), the last
// shows the bottom. Returns null when there is nothing to scroll.
export function scrollTargetFor(i, n, scrollHeight, clientHeight) {
  const max = scrollHeight - clientHeight;
  if (!(max > 4)) return null;
  const frac = n <= 1 ? 0 : Math.min(1, Math.max(0, i / (n - 1)));
  return Math.round(frac * max);
}
