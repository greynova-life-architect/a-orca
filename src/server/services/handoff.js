/**
 * Handoff files - .cursor-gen paths and read/write.
 */
const path = require('path');
const fs = require('fs');

function createHandoff(config) {
  const projectRoot = config.PROJECT_ROOT;
  const workingDir = config.WORKING_DIR;

  function getPromptPath() {
    return path.join(projectRoot, '.cursor-gen', 'prompt.txt');
  }

  function getPhasePath() {
    return path.join(projectRoot, '.cursor-gen', 'phase.txt');
  }

  function getInstructionsPath() {
    return path.join(projectRoot, '.cursor-gen', 'instructions.md');
  }

  function getGeneratedPlanPath() {
    return path.join(projectRoot, '.cursor-gen', 'generated-plan.json');
  }

  function getGeneratedTasksPath() {
    return path.join(projectRoot, '.cursor-gen', 'generated-tasks.json');
  }

  function getGeneratedQuestionsPath() {
    return path.join(projectRoot, '.cursor-gen', 'generated-questions.json');
  }

  function getGeneratedMilestoneQuestionsPath() {
    return path.join(projectRoot, '.cursor-gen', 'generated-milestone-questions.json');
  }

  function getGeneratedMilestonesPath() {
    return path.join(projectRoot, '.cursor-gen', 'generated-milestones.json');
  }

  function getProjectContextPath() {
    return path.join(projectRoot, '.cursor-gen', 'project-context.json');
  }

  function loadProjectContext() {
    const p = getProjectContextPath();
    if (!fs.existsSync(p)) return {};
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return {};
    }
  }

  function saveProjectContext(ctx) {
    const dir = path.dirname(getProjectContextPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      getProjectContextPath(),
      JSON.stringify(ctx, null, 2),
      'utf8'
    );
  }

  return {
    getPromptPath,
    getPhasePath,
    getInstructionsPath,
    getGeneratedPlanPath,
    getGeneratedTasksPath,
    getGeneratedQuestionsPath,
    getGeneratedMilestoneQuestionsPath,
    getGeneratedMilestonesPath,
    getProjectContextPath,
    loadProjectContext,
    saveProjectContext,
    workingDir,
  };
}

module.exports = { createHandoff };
