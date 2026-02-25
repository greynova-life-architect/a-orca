/**
 * JSON extraction from agent output (NDJSON, markdown blocks, inline JSON).
 * @module services/extractors
 */

/**
 * Generic JSON extraction with required key and validator.
 * @param {string} output - Raw agent output
 * @param {{ requiredKey: string, validator?: (p: object) => boolean }} opts
 * @returns {object|null}
 */
function extractJsonBySchema(output, { requiredKey, validator }) {
  if (!output || typeof output !== 'string') return null;

  function tryParse(text) {
    if (!text || typeof text !== 'string') return null;
    try {
      const parsed = JSON.parse(text);
      if (validator && !validator(parsed)) return null;
      if (requiredKey && !(requiredKey in parsed)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  const keyStart = `{"${requiredKey}"`;
  const idx = output.indexOf(keyStart);
  if (idx >= 0) {
    let depth = 0;
    let i = idx;
    while (i < output.length) {
      if (output[i] === '{') depth++;
      else if (output[i] === '}') {
        depth--;
        if (depth === 0) {
          const parsed = tryParse(output.slice(idx, i + 1));
          if (parsed) return parsed;
          break;
        }
      }
      i++;
    }
  }

  for (const m of output.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    const parsed = tryParse(m[1].trim());
    if (parsed) return parsed;
  }

  return null;
}

const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

/**
 * Try to parse a string as JSON array; optionally relax trailing comma / single quotes.
 * @param {string} text
 * @returns {Array|null}
 */
function tryParseJsonArray(text) {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw.startsWith('[')) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {}
  try {
    const relaxed = raw.replace(/,\s*\]/g, ']').replace(/,\s*}/g, '}').replace(/'/g, '"');
    return JSON.parse(relaxed);
  } catch (_) {}
  return null;
}

/**
 * Validate parsed array and convert to { orderedTaskIds, priorities? }.
 * @param {Array} arr
 * @param {Set<string>} validSet
 * @returns {{ orderedTaskIds: string[], priorities?: Record<string, string> }|null}
 */
function parsePrioritizedArray(arr, validSet) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0];
  if (typeof first === 'object' && first != null && 'id' in first) {
    const orderedTaskIds = [];
    const priorities = {};
    for (const item of arr) {
      const id = item?.id;
      if (typeof id === 'string' && (!validSet.size || validSet.has(id))) {
        orderedTaskIds.push(id);
        const p = item.priority;
        if (typeof p === 'string' && VALID_PRIORITIES.has(p.toLowerCase())) {
          priorities[id] = p.toLowerCase();
        }
      }
    }
    return orderedTaskIds.length ? { orderedTaskIds, priorities } : null;
  }
  const ids = arr.filter((x) => typeof x === 'string' && (!validSet.size || validSet.has(x)));
  return ids.length ? { orderedTaskIds: ids } : null;
}

/**
 * Extract ordered task IDs and optional priorities from agent output (prioritize phase).
 * Accepts: [{"id":"n1","priority":"high"},...] or ["id1","id2",...]
 * Tries: code blocks first, then last top-level [...] in text (agent often puts answer last).
 * @param {string} output
 * @param {string[]} validIds - allowed task IDs
 * @returns {{ orderedTaskIds: string[], priorities?: Record<string, string> }|null}
 */
function extractPrioritizedTasks(output, validIds = []) {
  if (!output || typeof output !== 'string') return null;
  const validSet = new Set(validIds);

  function tryText(str) {
    const arr = tryParseJsonArray(str);
    if (!arr) return null;
    return parsePrioritizedArray(arr, validSet);
  }

  // 1. Code blocks (agent often wraps JSON in ```json ... ```)
  for (const m of output.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    const t = m[1].trim();
    const result = tryText(t);
    if (result) return result;
  }

  // 2. Array that ends at the last ']' (agent often outputs prose then the final JSON array)
  const lastBracket = output.lastIndexOf(']');
  if (lastBracket >= 0) {
    let depth = 1;
    let start = lastBracket - 1;
    while (start >= 0) {
      if (output[start] === ']') depth++;
      else if (output[start] === '[') {
        depth--;
        if (depth === 0) {
          const result = tryText(output.slice(start, lastBracket + 1));
          if (result) return result;
          break;
        }
      }
      start--;
    }
  }

  // 3. First top-level array (original behavior)
  const idx = output.indexOf('[');
  if (idx >= 0) {
    let depth = 0;
    for (let i = idx; i < output.length; i++) {
      if (output[i] === '[') depth++;
      else if (output[i] === ']') {
        depth--;
        if (depth === 0) {
          const result = tryText(output.slice(idx, i + 1));
          if (result) return result;
          break;
        }
      }
    }
  }

  return null;
}


/**
 * Extract ordered task IDs array from agent output (backward compatible).
 * @param {string} output
 * @param {string[]} validIds - allowed task IDs
 * @returns {string[]|null}
 */
function extractOrderedTaskIds(output, validIds = []) {
  const result = extractPrioritizedTasks(output, validIds);
  return result ? result.orderedTaskIds : null;
}

function extractResultFromStreamJson(output) {
  if (!output || typeof output !== 'string') return null;
  let resultText = null;
  const parts = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const j = JSON.parse(line);
      if (j.type === 'result' && j.result != null) {
        resultText = String(j.result).trim();
      } else if (j.type === 'assistant' && j.message?.content) {
        const content = j.message.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c?.text != null) parts.push(String(c.text));
          }
        } else if (typeof content === 'string') {
          parts.push(content);
        }
      } else if ((j.type === 'thinking' || j.type === 'text' || j.type === 'message') && (j.text != null || j.content != null)) {
        parts.push(String(j.text != null ? j.text : j.content));
      } else if (j.content != null && typeof j.content === 'string') {
        parts.push(j.content);
      }
    } catch (_) {}
  }
  if (resultText) return resultText;
  if (parts.length) return parts.join('');
  return null;
}

/**
 * Normalize plan from various agent output formats to { project, features }.
 * @param {object} parsed
 * @returns {{ project: object, features: array }|null}
 */
function normalizePlan(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  let project = parsed.project || parsed.summary || {};
  let features = parsed.features || parsed.tasks || [];
  if (!Array.isArray(features)) features = [];
  if (parsed.plan && typeof parsed.plan === 'object') {
    project = parsed.plan.project || parsed.plan.summary || project;
    features = parsed.plan.features || parsed.plan.tasks || features;
  }
  if (typeof project !== 'object') project = { name: 'Plan', type: 'Feature', summary: String(project) };
  return { project, features };
}

/** @param {string} output - Agent output. @returns {{ project: object, features: array }|null} */
function extractPlanFromOutput(output) {
  const keys = ['project', 'features', 'plan'];
  const validators = {
    project: (p) => Array.isArray(p.features || p.tasks || []),
    features: (p) => Array.isArray(p.features || p.tasks || []),
    plan: (p) => p.plan && typeof p.plan === 'object' && Array.isArray(p.plan.features || p.plan.tasks || []),
  };
  for (const key of keys) {
    const parsed = extractJsonBySchema(output, {
      requiredKey: key,
      validator: validators[key],
    });
    if (parsed) {
      const plan = normalizePlan(parsed);
      if (plan?.features?.length) return plan;
    }
  }
  return null;
}

function extractTasksFromOutput(output) {
  return extractJsonBySchema(output, {
    requiredKey: 'nodes',
    validator: (p) => p.nodes && Array.isArray(p.nodes),
  });
}

function extractQuestionsFromOutput(output) {
  return extractJsonBySchema(output, {
    requiredKey: 'questions',
    validator: (p) => p.questions && Array.isArray(p.questions),
  });
}

function extractMilestonesFromOutput(output) {
  const parsed = extractJsonBySchema(output, {
    requiredKey: 'milestones',
    validator: (p) =>
      p.milestones &&
      Array.isArray(p.milestones) &&
      p.milestones.every(
        (m) => m && typeof m === 'object' && (m.id || m.name)
      ),
  });
  if (!parsed || !parsed.milestones) return null;
  const pivotal =
    parsed.pivotalMilestone &&
    typeof parsed.pivotalMilestone === 'object' &&
    parsed.pivotalMilestone.name
      ? {
          id: parsed.pivotalMilestone.id || 'mp',
          name: parsed.pivotalMilestone.name,
          description: parsed.pivotalMilestone.description || null,
        }
      : null;
  return {
    milestones: parsed.milestones.map((m, i) => ({
      id: m.id || 'm' + (i + 1),
      name: m.name || 'Milestone ' + (i + 1),
      description: m.description || null,
      sort_order: typeof m.sort_order === 'number' ? m.sort_order : i,
    })),
    pivotalMilestone: pivotal,
  };
}

function tryParseAssessmentJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    const parsed = JSON.parse(text);
    const features = Array.isArray(parsed.features) ? parsed.features : [];
    const description = (parsed.description || parsed.summary || '')
      .trim()
      .slice(0, 2000);
    const assessment = (parsed.analysis || parsed.assessment || '')
      .trim()
      .slice(0, 100000);
    if (features.length || description.length > 20 || assessment.length > 50) {
      return { features, description, assessment };
    }
    return null;
  } catch (_) {
    return null;
  }
}

/** Find first { and matching }, return parsed assessment or null. */
function extractAssessmentJsonFromProse(text) {
  if (!text || typeof text !== 'string') return null;
  const idx = text.indexOf('{');
  if (idx < 0) return null;
  let depth = 0;
  for (let i = idx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        const slice = text.slice(idx, i + 1);
        const parsed = tryParseAssessmentJson(slice);
        if (parsed) return parsed;
        return null;
      }
    }
  }
  return null;
}

function extractAssessmentFromOutput(output) {
  if (!output || typeof output !== 'string')
    return { features: [], description: '', assessment: '' };
  const result = { features: [], description: '', assessment: '' };

  let accumulated = '';
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const j = JSON.parse(line);
      let text = null;
      if (j.type === 'result' && j.result != null) text = String(j.result);
      else if (j.type === 'assistant' && j.message?.content) {
        text = (j.message.content || []).map((c) => c?.text || '').join('');
      }
      if (text) accumulated += text;
    } catch (_) {}
  }
  if (accumulated) {
    const parsed = tryParseAssessmentJson(accumulated);
    if (parsed) return parsed;
    const fromProse = extractAssessmentJsonFromProse(accumulated);
    if (fromProse) return fromProse;
  }

  let best = null;
  for (const m of output.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    const parsed = tryParseAssessmentJson(m[1].trim());
    if (parsed) {
      const score =
        (parsed.features?.length || 0) * 10 +
        (parsed.assessment?.length || 0) +
        (parsed.description?.length || 0);
      if (!best || score > (best.features?.length || 0) * 10 + (best.assessment?.length || 0) + (best.description?.length || 0)) {
        best = parsed;
      }
    }
  }
  if (best) return best;

  const jsonMatch = output.match(/\{[\s\S]*?"features"[\s\S]*?\}/);
  if (jsonMatch) {
    const parsed = tryParseAssessmentJson(jsonMatch[0]);
    if (parsed) return parsed;
  }

  const fromProse = extractAssessmentJsonFromProse(output);
  if (fromProse) return fromProse;

  return result;
}

function extractPromptsFromOutput(output, taskIds) {
  if (!output || typeof output !== 'string') return {};
  const result = {};
  const parsed = extractJsonBySchema(output, {
    requiredKey: 'prompts',
    validator: (p) => p.prompts && Array.isArray(p.prompts),
  });
  if (parsed && parsed.prompts) {
    for (const p of parsed.prompts) {
      if (p.taskId && p.prompt && taskIds.includes(p.taskId)) {
        result[p.taskId] = String(p.prompt).trim();
      }
    }
  }
  return result;
}

/**
 * Parse assessment string into structured sections for LLM context.
 * Handles ```json blocks, raw JSON, and ━━━ formatted text.
 * @param {string} raw
 * @returns {{ overview: string, analysis: string, features: array }|null}
 */
function parseAssessmentToStructured(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const unescape = (s) => (s || '').replace(/\\n/g, '\n').trim();
  const toStructured = (parsed) => {
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed)) {
      return { overview: '', analysis: '', features: parsed.map((f) => ({ id: f?.id, name: f?.name || f?.id || 'Feature', description: unescape(f?.description) })) };
    }
    const desc = unescape(parsed.description);
    const analysis = unescape(parsed.analysis || parsed.assessment);
    const feats = (parsed.features || []).map((f) => ({ id: f?.id, name: f?.name || f?.id || 'Feature', description: unescape(f?.description) }));
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
          const score = (s.features?.length || 0) * 10 + (s.analysis?.length || 0) + (s.overview?.length || 0);
          if (!best || score > (best.score || 0)) best = { structured: s, score };
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
      else if (title.includes('detailed analysis') || title.includes('analysis')) out.analysis = body;
      else if (title.includes('features')) {
        const blocks = body.split(/\n\n+/);
        for (const block of blocks) {
          const first = (block.split(/\n/)[0] || '').trim();
          const m = first.match(/^[•\-*]\s+(.+?)(?:\s*\(([^)]+)\))?\s*$/);
          if (m) {
            const desc = block.replace(/^[•\-*]\s+.+?(?:\s*\([^)]+\))?\s*\n?/, '').replace(/^\s+/gm, '').trim();
            out.features.push({ id: m[2], name: m[1].trim(), description: desc });
          } else if (first) out.features.push({ name: first.replace(/^[•\-*]\s+/, '').trim(), description: '' });
        }
      }
    }
    if (out.overview || out.analysis || out.features.length) return out;
  }
  return null;
}

/**
 * Format extracted assessment for display. Combines description, analysis, and features.
 * @param {{ features: array, description: string, assessment: string }} extracted
 * @returns {string}
 */
function unescapeNewlines(s) {
  if (!s || typeof s !== 'string') return s;
  return s.replace(/\\n/g, '\n').trim();
}

function formatAssessmentForDisplay(extracted) {
  if (!extracted) return '';
  const desc = unescapeNewlines(extracted.description);
  const analysis = unescapeNewlines(extracted.assessment);
  const features = extracted.features || [];
  const parts = [];

  if (desc) {
    parts.push('━━━ Overview ━━━\n' + desc);
  }
  if (analysis) {
    parts.push('━━━ Detailed Analysis ━━━\n' + analysis);
  }
  if (Array.isArray(features) && features.length > 0) {
    const featureLines = features.map((f) => {
      const name = f.name || f.id || 'Feature';
      const id = f.id ? ` (${f.id})` : '';
      const d = unescapeNewlines(f.description);
      return d ? `• ${name}${id}\n  ${d}` : `• ${name}${id}`;
    });
    parts.push('━━━ Features Identified ━━━\n' + featureLines.join('\n\n'));
  }

  return parts.join('\n\n') || '';
}

module.exports = {
  extractJsonBySchema,
  extractResultFromStreamJson,
  extractOrderedTaskIds,
  extractPrioritizedTasks,
  normalizePlan,
  extractPlanFromOutput,
  extractTasksFromOutput,
  extractQuestionsFromOutput,
  extractMilestonesFromOutput,
  extractAssessmentFromOutput,
  extractPromptsFromOutput,
  formatAssessmentForDisplay,
  parseAssessmentToStructured,
};
