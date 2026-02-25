/**
 * Prompt builders for cursor-agent phases.
 */
const path = require('path');
const fs = require('fs');

/**
 * Build structured assessment context for LLM prompts.
 * Returns a string with clear sections for Overview, Analysis, Identified Features, and Requested Features.
 * @param {{ summary: string, assessment: string, features: array, tasks: array }} projectData
 * @param {(s: string) => { overview: string, analysis: string, features: array }|null} parseAssessment
 */
function buildAssessmentContext(projectData, parseAssessment) {
  if (!projectData) return '';
  const { summary, assessment, features = [], tasks = [] } = projectData;
  const sections = [];

  const parsed = assessment && parseAssessment ? parseAssessment(assessment) : null;
  const overview = parsed?.overview || summary || '';
  const analysis = parsed?.analysis || '';
  const identifiedFeatures = parsed?.features || [];

  const featureIdsWithTasks = new Set(tasks.map((t) => t.feature_id));
  const requestedFeatures = features.filter(
    (f) => !featureIdsWithTasks.has(f.id) && f.id !== '_none'
  );

  if (overview) {
    sections.push(`## OVERVIEW (existing project)\n${overview}`);
  }
  if (analysis) {
    sections.push(`## DETAILED ANALYSIS\n${analysis}`);
  }
  if (identifiedFeatures.length) {
    const lines = identifiedFeatures.map(
      (f) => `- ${f.name}${f.id ? ` (${f.id})` : ''}: ${f.description || ''}`
    );
    sections.push(`## IDENTIFIED FEATURES (from codebase assessment)\n${lines.join('\n')}`);
  }
  if (requestedFeatures.length) {
    const lines = requestedFeatures.map(
      (f) => `- ${f.name}${f.id ? ` (${f.id})` : ''}: ${f.description || ''}`
    );
    sections.push(`## REQUESTED / FUTURE FEATURES (user-added, to be planned)\n${lines.join('\n')}`);
  }

  if (sections.length === 0) return '';
  return `\n---\nEXISTING PROJECT CONTEXT (reference these sections when planning):\n---\n${sections.join('\n\n')}\n---\n`;
}

function createPrompts(handoff) {
  const workingDir = handoff.workingDir;

  function buildQuestionsPrompt(projectType, userPrompt, assessmentContext, actionType, targetFeature) {
    const scopeBlock =
      actionType === 'full_application'
        ? 'Planning scope: FULL APPLICATION — plan for the entire project.'
        : actionType === 'new_feature'
          ? 'Planning scope: NEW FEATURE — plan a new feature to add.'
          : targetFeature
            ? `Planning scope: ENHANCE EXISTING FEATURE — focus on "${targetFeature.name}"${targetFeature.description ? `: ${targetFeature.description}` : ''}.`
            : '';
    const contextBlock = assessmentContext
      ? `\n${assessmentContext}\nWhen asking questions, consider the existing project context above. Tailor your questions to build on or extend what exists.`
      : '';
    return `You are a project planning assistant. ${scopeBlock}

${userPrompt ? `User request / description:\n---\n${userPrompt}\n---\n` : ''}${contextBlock}

Your ONLY job is to output clarifying questions. Do NOT create a plan. Do NOT list tasks or features. Do NOT output anything except the questions JSON.

Output 5-10 questions as JSON:
{
  "questions": [
    { "id": "q1", "question": "What is the primary goal?", "hint": "optional hint" }
  ]
}

Write to project-map/.cursor-gen/generated-questions.json or output the JSON in a \`\`\`json block.
Use short ids like q1, q2, q3. Output ONLY this JSON, nothing else.`;
  }

  function buildPhase1Prompt(projectType, questionAnswers, userPrompt, assessmentContext, actionType, targetFeature) {
    let instructions = '';
    try {
      instructions = fs.readFileSync(handoff.getInstructionsPath(), 'utf8');
    } catch (_) {
      instructions = 'Generate a plan with project summary and features.';
    }
    const scopeBlock =
      actionType === 'full_application'
        ? 'Scope: Plan for the FULL APPLICATION.'
        : actionType === 'new_feature'
          ? 'Scope: Plan a NEW FEATURE to add.'
          : targetFeature
            ? `Scope: Plan enhancements for the existing feature "${targetFeature.name}". Focus only on tasks that improve or extend this feature.`
            : '';
    const qaBlock = questionAnswers?.length
      ? `User answers:\n${questionAnswers.map((q) => `- ${q.question}: ${q.answer || '(unanswered)'}`).join('\n')}\n`
      : '';
    const contextBlock = assessmentContext
      ? `\n${assessmentContext}\nReference the sections above (Overview, Analysis, Identified Features, Requested Features) when creating the plan.`
      : '';
    return `You are helping to create a project plan.

${instructions}

${scopeBlock}
${qaBlock}${userPrompt ? `User request / additional context:\n---\n${userPrompt}\n---\n` : ''}${contextBlock}

Output a SUMMARY (project name, type, brief overview) and a LIST OF TASKS. Each task has id, name, description only. Do NOT include prompts.
Run in this workspace. You MUST write your JSON output to this file: project-map/.cursor-gen/generated-plan.json
(Full path: ${path.join(workingDir, 'project-map', '.cursor-gen', 'generated-plan.json')})

If you cannot write files, output the JSON inside a markdown code block: \`\`\`json ... \`\`\`

Output only valid JSON, no extra text.`;
  }

  function buildPhase2Prompt(plan) {
    const planJson = JSON.stringify(plan, null, 2);
    return `You are helping to create tasks from a project plan.

Read the plan from project-map/.cursor-gen/generated-plan.json. Current content:
---
${planJson}
---

Create task nodes (modules) for each feature. Write your output to: project-map/.cursor-gen/generated-tasks.json
(Full path: ${path.join(workingDir, 'project-map', '.cursor-gen', 'generated-tasks.json')})

If you cannot write files, output the JSON inside a markdown code block: \`\`\`json ... \`\`\`

Format:
{
  "nodes": [
    { "id": "n_xxx", "title": "...", "description": "...", "feature_id": "f_abc", "status": "todo", "prompt": "..." }
  ]
}

Use short unique ids (e.g. n_abc123). Link each node to a feature via feature_id.
Output only valid JSON, no extra text.`;
  }

  function buildGeneratePromptsPrompt(features) {
    const taskList = features
      .map((f, i) => {
        const nid = 'n_' + (f.id || 'f' + i).replace(/^f/, '');
        return `- ${nid}: ${f.name} — ${f.description || ''}`;
      })
      .join('\n');
    return `Generate a concise implementation prompt for each task. Output JSON only:

{
  "prompts": [
    { "taskId": "n_xxx", "prompt": "Clear instruction for the agent to implement this task" }
  ]
}

Tasks:
${taskList}

Each prompt should be 1-3 sentences. Include the task context. Output only valid JSON.`;
  }

  function buildTaskExecutionPrompt(task, assessmentContext) {
    const title = task?.title || 'Task';
    const description = task?.description || '';
    const instructions = (task?.prompt || '').trim() || (description ? `${title}\n\n${description}` : title);
    const contextBlock = assessmentContext
      ? `\n---\nPROJECT CONTEXT (for reference):\n---\n${assessmentContext}\n---\n`
      : '';
    return `Execute the following task in this workspace. Do NOT generate a prompt or describe what to do — implement the changes directly. Read and edit files as needed. Create or update files to accomplish the task.

${contextBlock}## TASK
${instructions}

Proceed with implementation. Use the codebase tools to read, search, and edit files.`;
  }

  function buildPrioritizePrompt(tasks, assessmentContext) {
    const taskList = (tasks || [])
      .map(
        (t, i) =>
          `${i + 1}. [${t.id}] ${t.title}${t.description ? ': ' + t.description.slice(0, 120) : ''} (status: ${t.status}${t.priority ? ', priority: ' + t.priority : ''})`
      )
      .join('\n');
    return `You are a project planning assistant. Prioritize these tasks for implementation order.

## TASKS
${taskList}
${assessmentContext ? `\n## PROJECT CONTEXT\n${assessmentContext}\n` : ''}

## YOUR TASK
Consider: dependencies (setup/schema/core first), business value, effort vs. value, risk.
Output ONLY a valid JSON array—no explanation, no markdown, no other text. Either format:
- With priority: [{"id":"<taskId>","priority":"high|medium|low"}, ...]
- Order only: ["<taskId>","<taskId>", ...]
Use the exact task IDs from the list above. First element = highest priority. Output nothing but the array.`;
  }

  function buildMilestoneQuestionsPrompt(projectKind, userPrompt, assessmentContext) {
    const kind = projectKind || 'coding';
    const contextBlock = assessmentContext
      ? `\n${assessmentContext}\nWhen asking questions, consider the existing project context above.`
      : '';
    if (kind === 'coding') {
      return `You are helping define milestones for a software project (e.g. sprints, releases, phases).

${userPrompt ? `User request / description:\n---\n${userPrompt}\n---\n` : ''}${contextBlock}

Your ONLY job is to output clarifying questions. Do NOT propose milestones yet. Do NOT list tasks. Output 5-10 questions as JSON about timeline, scope, deliverables, and dependencies.

Output format:
{
  "questions": [
    { "id": "q1", "question": "What is the timeline?", "hint": "optional hint" }
  ]
}

Write to project-map/.cursor-gen/generated-milestone-questions.json or output the JSON in a \`\`\`json block.
Use short ids like q1, q2, q3. Output ONLY this JSON, nothing else.`;
    }
    return `You are helping define milestones for a project.

${userPrompt ? `User request:\n---\n${userPrompt}\n---\n` : ''}${contextBlock}

Output 5-10 clarifying questions as JSON: { "questions": [ { "id", "question", "hint" } ] }.
Write to project-map/.cursor-gen/generated-milestone-questions.json or output in a \`\`\`json block. Output ONLY JSON.`;
  }

  function buildMilestonePlanPrompt(projectKind, questionAnswers, userPrompt, assessmentContext) {
    const kind = projectKind || 'coding';
    const qaBlock = questionAnswers?.length
      ? `User answers:\n${questionAnswers.map((q) => `- ${q.question}: ${q.answer || '(unanswered)'}`).join('\n')}\n`
      : '';
    const contextBlock = assessmentContext
      ? `\n${assessmentContext}\n`
      : '';
    if (kind === 'coding') {
      return `You are helping define milestones for a software project.

Using the answers below, propose 3-8 milestones (e.g. Phase 1: Setup, Phase 2: Core features, Phase 3: Polish).
${qaBlock}${userPrompt ? `User context:\n---\n${userPrompt}\n---\n` : ''}${contextBlock}

Additionally, suggest ONE milestone that would be pivotal for this project's growth (e.g. technical foundation, user validation, performance, or reducing risk). Output it as pivotalMilestone.

Output JSON:
{
  "milestones": [
    { "id": "m1", "name": "Phase 1: Setup", "description": "Brief description", "sort_order": 0 }
  ],
  "pivotalMilestone": { "id": "mp", "name": "Suggested milestone name", "description": "Why it is pivotal" }
}

Write to project-map/.cursor-gen/generated-milestones.json or output the JSON in a \`\`\`json block.
Use short ids (m1, m2, ...). sort_order: 0-based. pivotalMilestone is optional. Output ONLY valid JSON, no extra text.`;
    }
    return `Propose 3-8 milestones based on the answers.
${qaBlock}${userPrompt ? `Context:\n${userPrompt}\n` : ''}${contextBlock}
Output JSON: { "milestones": [ { "id", "name", "description", "sort_order" } ] }.
Write to project-map/.cursor-gen/generated-milestones.json or \`\`\`json block. Output ONLY JSON.`;
  }

  function buildAssessPrompt(rootPath) {
    return `You are assessing this project folder: ${rootPath}

## CRITICAL WORKFLOW: FOLDER STRUCTURE FIRST

**Step 1 – Understand layout before touching files**
- List the TOP-LEVEL directory structure only (directories and key files at root)
- Do NOT glob, grep, or read file contents yet
- Identify: src/, app/, lib/, packages/, etc. – what is the high-level layout?
- NEVER read or traverse: node_modules, .git, dist, build, .next, coverage, __pycache__, .venv, venv

**Step 2 – Based on structure, read selectively**
- From the layout, decide which config files matter (e.g. package.json, requirements.txt, Cargo.toml, go.mod at root)
- Read only those plus a FEW key source files to infer tech stack and architecture
- Do NOT read individual source files up front – work from folder structure and config first

**Step 3 – Produce assessment**

Produce a COMPREHENSIVE assessment covering:
1. Tech stack: package names, versions, frameworks, runtimes (from config files)
2. Architecture: entry points, main modules, data flow
3. Folder structure: key dirs and their purpose
4. Configuration: env vars, config files, build/deploy
5. Database/ORM, API/routes, testing, key patterns

Structure the "analysis" field with markdown headings so it is easy to scan. Use ## for each major section, e.g.:
## Application Architecture
## Database Layer
## REST API
## Configuration
## Testing
(adapt section names to the project). Write 2-4 paragraphs per section with specific paths and concrete details.

## OUTPUT FORMAT (valid JSON only, no markdown)

{
  "description": "2-4 sentence overview of what this project does.",
  "analysis": "Analysis text with ## Section Name headings as above. Multiple sections, each with 2-4 paragraphs.",
  "features": [
    {"id":"f1","name":"Auth","description":"Detailed: JWT via passport. Routes in src/auth/."},
    {"id":"f2","name":"API","description":"Detailed: Express in src/api/."}
  ]
}

Use short ids f1, f2, f3. Include 3-10 features. All paths must be inside: ${rootPath}`;
  }

  return {
    buildQuestionsPrompt,
    buildPhase1Prompt,
    buildPhase2Prompt,
    buildGeneratePromptsPrompt,
    buildAssessPrompt,
    buildPrioritizePrompt,
    buildTaskExecutionPrompt,
    buildMilestoneQuestionsPrompt,
    buildMilestonePlanPrompt,
  };
}

module.exports = { createPrompts, buildAssessmentContext };
