// A tiny drifting-network simulation for the splash background (pure functions, so it can be tested
// without a browser). Nodes wander slowly and bounce off the edges; near neighbours are joined by
// faint lines that fade with distance, which reads as "a network that is thinking".

export function nodeCountFor(w, h) {
  return Math.max(14, Math.min(46, Math.round((w * h) / 24000)));
}

export function makeNodes(w, h, count, rng = Math.random) {
  return Array.from({ length: count }, () => {
    const angle = rng() * Math.PI * 2;
    const speed = 0.012 + rng() * 0.02; // px per ms
    return { x: rng() * w, y: rng() * h, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 1.2 + rng() * 1.8, hue: Math.floor(rng() * 3) };
  });
}

export function stepNodes(nodes, w, h, dtMs) {
  const dt = Math.min(64, Math.max(0, dtMs)); // a long pause (tab hidden) must not teleport nodes
  for (const n of nodes) {
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx); }
    else if (n.x > w) { n.x = w; n.vx = -Math.abs(n.vx); }
    if (n.y < 0) { n.y = 0; n.vy = Math.abs(n.vy); }
    else if (n.y > h) { n.y = h; n.vy = -Math.abs(n.vy); }
  }
  return nodes;
}

export function edgesFor(nodes, maxDist) {
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < maxDist) edges.push({ a: i, b: j, alpha: 1 - d / maxDist });
    }
  }
  return edges;
}
