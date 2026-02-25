import { useEffect, useRef } from 'react';
import API from '../api';
import { useStore } from '../store';

const OUTPUT_STEP_TYPE = 'context';
const COALESCE_MIN_LEN = 120;
const MAX_STEP_CHARS = 400;

/**
 * When cursorWaiting and cursorPhase is questions/plan/task/test, open SSE
 * to the cursor stream and update store. Handle done/error and call store actions.
 * Pushes LLM output as context/thinking steps (coalesced) so agent reasoning appears before file actions.
 */
export function useCursorStream() {
  const cursorPhase = useStore((s) => s.cursorPhase);
  const cursorWaiting = useStore((s) => s.cursorWaiting);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const cursorStreamTaskId = useStore((s) => s.cursorStreamTaskId);
  const agentSetStatusMessage = useStore((s) => s.agentSetStatusMessage);
  const agentPushStep = useStore((s) => s.agentPushStep);
  const agentPushFileStep = useStore((s) => s.agentPushFileStep);
  const agentSaveRunLog = useStore((s) => s.agentSaveRunLog);
  const agentClearLive = useStore((s) => s.agentClearLive);
  const setCursorStreamState = useStore((s) => s.setCursorStreamState);
  const setPendingQuestions = useStore((s) => s.setPendingQuestions);
  const setPendingPlan = useStore((s) => s.setPendingPlan);
  const setPendingMilestoneQuestions = useStore((s) => s.setPendingMilestoneQuestions);
  const setPendingMilestonePlan = useStore((s) => s.setPendingMilestonePlan);
  const generateMilestonePlanFromAnswers = useStore((s) => s.generateMilestonePlanFromAnswers);
  const applyTasks = useStore((s) => s.applyTasks);
  const triggerNextTask = useStore((s) => s.triggerNextTask);
  const startPlanPhase = useStore((s) => s.startPlanPhase);
  const setMapNodeStatus = useStore((s) => s.setMapNodeStatus);

  const outputBufferRef = useRef('');

  useEffect(() => {
    outputBufferRef.current = '';
    const phases = ['questions', 'plan', 'task', 'test', 'milestone_questions', 'milestone_plan'];
    if (!cursorWaiting || !phases.includes(cursorPhase)) return;

    const taskId = cursorPhase === 'task' ? cursorStreamTaskId : null;
    const url = API.cursor.streamUrl(
      cursorPhase,
      currentProjectId || undefined,
      taskId || undefined
    );
    const es = new EventSource(url);
    const getState = useStore.getState;

    const closeRef = getState().cursorStreamCloseRef;
    closeRef.current = () => {
      es.close();
      setCursorStreamState({ cursorWaiting: false, cursorStreamText: '' });
    };

    function flushOutputBuffer() {
      const buf = outputBufferRef.current.trim();
      if (!buf) return;
      outputBufferRef.current = '';
      const text = buf.length > MAX_STEP_CHARS ? buf.slice(0, MAX_STEP_CHARS) + '…' : buf;
      agentPushStep(text, OUTPUT_STEP_TYPE);
    }

    es.addEventListener('status', (e) => {
      try {
        const d = JSON.parse(e.data);
        agentSetStatusMessage(d.message || '');
        agentPushStep(d.message || '', 'status');
      } catch (_) {}
    });

    es.addEventListener('output', (e) => {
      try {
        const d = JSON.parse(e.data);
        const t = (d.text ?? '').trim();
        if (t === '') return;
        // Only skip standalone "-" when it's the first chunk (cursor-agent connection artifact); don't drop "-" mid-stream
        const streamSoFar = getState().cursorStreamText || '';
        if (t === '-' && streamSoFar === '') return;
        const suffix = d.type === 'stderr' ? '\n[stderr] ' + t : t;
        setCursorStreamState((s) => ({
          cursorStreamText: (s.cursorStreamText || '') + suffix,
        }));
        outputBufferRef.current += suffix;
        if (
          outputBufferRef.current.includes('\n') ||
          outputBufferRef.current.length >= COALESCE_MIN_LEN
        ) {
          flushOutputBuffer();
        }
      } catch (_) {}
    });

    es.addEventListener('agentActivity', (e) => {
      try {
        flushOutputBuffer();
        const d = JSON.parse(e.data);
        agentPushFileStep(d);
      } catch (_) {}
    });

    es.addEventListener('done', (e) => {
      try {
        const d = JSON.parse(e.data);
        es.close();
        const phase = d.phase;
        const keepStreamText = ['questions', 'plan', 'milestone_questions', 'milestone_plan'].includes(phase);
        setCursorStreamState({
          cursorWaiting: false,
          ...(keepStreamText ? {} : { cursorStreamText: '' }),
        });
        const st = getState();
        if (d.error) {
          setCursorStreamState({ cursorError: d.error });
          return;
        }
        if (d.phase === 'test') {
          setCursorStreamState({
            cursorError: null,
            cursorTestResult: d.output?.trim()
              ? 'LLM response: ' + d.output.trim()
              : d.success
                ? 'Connected (no output)'
                : 'No response received',
          });
          return;
        }
        if (d.phase === 'questions') {
          if (d.questions?.length > 0) {
            setPendingQuestions(
              d.questions.map((q) => ({ ...q, answer: '' }))
            );
          } else {
            startPlanPhase([]);
          }
        } else if (d.phase === 'milestone_questions') {
          if (d.questions?.length > 0) {
            setPendingMilestoneQuestions(
              d.questions.map((q) => ({ ...q, answer: '' }))
            );
          } else {
            generateMilestonePlanFromAnswers([]);
          }
        } else if (d.phase === 'milestone_plan') {
          if (d.milestones?.length > 0) {
            setCursorStreamState({
              pendingMilestonePlan: {
                milestones: d.milestones,
                pivotalMilestone: d.pivotalMilestone ?? null,
              },
              cursorError: null,
            });
          } else if (d.error) {
            setCursorStreamState({ cursorError: d.error });
          }
        } else if (d.phase === 'plan') {
          if (d.plan) {
            setCursorStreamState({
              pendingPlan: d.plan,
              taskAgentAssignments: {},
              cursorError: null,
            });
          } else if (d.error) {
            setCursorStreamState({ cursorError: d.error });
          }
        } else if (d.phase === 'tasks' && d.tasks) {
          st.applyTasks(d.tasks);
          setCursorStreamState({ pendingPlan: null, cursorError: null });
        } else if (d.phase === 'task') {
          flushOutputBuffer();
          const taskId = st.cursorStreamTaskId;
          if (taskId) {
            const st2 = getState();
            st2.agentSaveRunLog(taskId, {
              steps: st2.agentActivity.live.steps,
              files: st2.agentActivity.live.files,
            });
            st2.agentClearLive();
            API.tasks
              .update(st2.currentProjectId, taskId, { status: 'in_review' })
              .then(() => getState().setMapNodeStatus(taskId, 'in_review'))
              .catch((e) => setCursorStreamState({ cursorError: e.message }));
          }
          st.triggerNextTask();
        }
      } catch (_) {}
    });

    es.addEventListener('error', () => {
      es.close();
      setCursorStreamState({ cursorWaiting: false, cursorStreamText: '' });
      const st = getState();
      if (!st.pendingPlan && !st.pendingMilestonePlan && !st.cursorError) {
        setCursorStreamState({ cursorError: 'Connection lost or server error.' });
      }
    });

    return () => {
      if (closeRef) closeRef.current = null;
      es.close();
    };
  }, [
    cursorPhase,
    cursorWaiting,
    currentProjectId,
    cursorStreamTaskId,
    agentSetStatusMessage,
    agentPushStep,
    agentPushFileStep,
    agentSaveRunLog,
    agentClearLive,
    setCursorStreamState,
    setPendingQuestions,
    setPendingPlan,
    setPendingMilestoneQuestions,
    setPendingMilestonePlan,
    generateMilestonePlanFromAnswers,
    applyTasks,
    triggerNextTask,
    startPlanPhase,
    setMapNodeStatus,
  ]);
}
