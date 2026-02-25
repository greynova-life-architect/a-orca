/**
 * Parse raw assessment string into structured { overview, analysis, features }.
 */
export function parseAssessmentToStructured(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const unescape = (s) => (s || '').replace(/\\n/g, '\n').trim();
  const toStructured = (parsed) => {
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed)) {
      return {
        overview: '',
        analysis: '',
        features: parsed.map((f) => ({
          id: f?.id,
          name: f?.name || f?.id || 'Feature',
          description: unescape(f?.description),
        })),
      };
    }
    const desc = unescape(parsed.description);
    const analysis = unescape(parsed.analysis || parsed.assessment);
    const feats = (parsed.features || []).map((f) => ({
      id: f?.id,
      name: f?.name || f?.id || 'Feature',
      description: unescape(f?.description),
    }));
    if (!desc && !analysis && !feats.length) return null;
    return { overview: desc, analysis, features: feats };
  };
  if (raw.includes('```json') || raw.includes('```\n{')) {
    let best = null;
    for (const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
      try {
        const parsed = JSON.parse(m[1].trim());
        const s = toStructured(parsed);
        if (s) {
          const score =
            (s.features?.length || 0) * 10 +
            (s.analysis?.length || 0) +
            (s.overview?.length || 0);
          if (!best || score > (best.score || 0))
            best = { structured: s, score };
        }
      } catch (_) {}
    }
    if (best?.structured) return best.structured;
  }
  try {
    const s = toStructured(JSON.parse(raw.trim()));
    if (s) return s;
  } catch (_) {}
  if (raw.includes('━━━')) {
    const sections = raw.split(/━━━\s*(.+?)\s*━━━/);
    const out = { overview: '', analysis: '', features: [] };
    for (let i = 1; i < sections.length; i += 2) {
      const title = (sections[i] || '').trim().toLowerCase();
      const body = (sections[i + 1] || '').trim();
      if (title.includes('overview')) out.overview = body;
      else if (
        title.includes('detailed analysis') ||
        title.includes('analysis')
      )
        out.analysis = body;
      else if (title.includes('features')) {
        const blocks = body.split(/\n\n+/);
        for (const block of blocks) {
          const first = block.split(/\n/)[0] || '';
          const m = first.match(/^[•\-*]\s+(.+?)(?:\s*\(([^)]+)\))?\s*$/);
          if (m) {
            const desc = block
              .replace(/^[•\-*]\s+.+?(?:\s*\([^)]+\))?\s*\n?/, '')
              .replace(/^\s+/gm, '')
              .trim();
            out.features.push({
              id: m[2],
              name: m[1].trim(),
              description: desc,
            });
          } else if (first.trim())
            out.features.push({
              name: first.replace(/^[•\-*]\s+/, '').trim(),
              description: '',
            });
        }
      }
    }
    if (out.overview || out.analysis || out.features.length) return out;
  }
  return null;
}

/**
 * Split analysis string by ## or ### headings into subsections for display.
 * @param {string} analysis
 * @returns {{ title: string, body: string }[]}
 */
export function parseAnalysisSubsections(analysis) {
  if (!analysis || typeof analysis !== 'string') return [];
  const trimmed = analysis.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\n(?=#{2,3}\s+)/);
  const sections = [];
  for (const part of parts) {
    const match = part.match(/^(#{2,3}\s+)(.+)$/m);
    if (match) {
      const body = part.slice(match[0].length).trim();
      if (body || match[2].trim()) {
        sections.push({ title: match[2].trim(), body });
      }
    } else if (part.trim()) {
      sections.push({ title: '', body: part.trim() });
    }
  }
  if (sections.length === 0) return [{ title: '', body: trimmed }];
  return sections;
}

export function formatAssessmentForDisplay(raw) {
  if (!raw || typeof raw !== 'string') return raw || '';
  const s = parseAssessmentToStructured(raw);
  if (s) {
    const parts = [];
    if (s.overview) parts.push('━━━ Overview ━━━\n' + s.overview);
    if (s.analysis) parts.push('━━━ Detailed Analysis ━━━\n' + s.analysis);
    if (s.features?.length) {
      const lines = s.features.map((f) =>
        f.description
          ? `• ${f.name}${f.id ? ' (' + f.id + ')' : ''}\n  ${f.description}`
          : `• ${f.name}${f.id ? ' (' + f.id + ')' : ''}`
      );
      parts.push('━━━ Features Identified ━━━\n' + lines.join('\n\n'));
    }
    if (parts.length) return parts.join('\n\n');
  }
  if (raw.includes('━━━') && !raw.includes('```json')) return raw;
  return raw;
}

export function formatThinkingForDisplay(text) {
  if (!text) return '';
  const t = text.trim();
  if (
    (t.startsWith('{') && t.includes('"description"')) ||
    (t.startsWith('{') &&
      t.includes('"analysis"') &&
      t.includes('"features"'))
  ) {
    return 'Compiling structured assessment (Overview, Analysis, Features)...';
  }
  return text.replace(/\s+/g, ' ').replace(/\.\s+/g, '.\n\n').trim();
}
