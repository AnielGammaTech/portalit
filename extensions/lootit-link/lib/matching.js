// Fuzzy customer name matching

export function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

export function matchCustomer(vendorName, customers) {
  const vn = normalize(vendorName);
  if (!vn) return null;

  // Exact match
  for (const c of customers) {
    if (normalize(c.name) === vn) return c;
  }

  // Contains
  for (const c of customers) {
    const cn = normalize(c.name);
    if (cn.includes(vn) || vn.includes(cn)) return c;
  }

  // Word overlap (>= 50%)
  const vWords = vn.split(/\s+/).filter(w => w.length > 2);
  let best = null;
  let bestScore = 0;
  for (const c of customers) {
    const cWords = normalize(c.name).split(/\s+/).filter(w => w.length > 2);
    const overlap = vWords.filter(vw => cWords.some(cw => cw.includes(vw) || vw.includes(cw))).length;
    const score = vWords.length > 0 ? overlap / vWords.length : 0;
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
