import { useEffect, useRef } from 'react';
import API from '../api';
import { useStore } from '../store';

/**
 * When assessStreamProjectId is set and cursorPhase === 'assess', open SSE
 * to the assess stream and update store on events. Clear assessStreamProjectId on done/error.
 */
export function useAssessStream() {
  const assessStreamProjectId = useStore((s) => s.assessStreamProjectId);
  const setCursorAssessState = useStore((s) => s.setCursorAssessState);
  const agentSetStatusMessage = useStore((s) => s.agentSetStatusMessage);
  const agentPushStep = useStore((s) => s.agentPushStep);
  const agentPushFile = useStore((s) => s.agentPushFile);
  const agentClearLive = useStore((s) => s.agentClearLive);
  const loadProject = useStore((s) => s.loadProject);
  const clearAssessStreamProjectId = useStore((s) => s.clearAssessStreamProjectId);
  const esRef = useRef(null);

  useEffect(() => {
    if (!assessStreamProjectId) return;
    const url = API.projects.assessStreamUrl(assessStreamProjectId);
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('folder', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.rootPath) setCursorAssessState({ cursorAssessFolder: d.rootPath });
      } catch (_) {}
    });

    es.addEventListener('prompt', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.prompt) setCursorAssessState({ cursorAssessPrompt: d.prompt });
      } catch (_) {}
    });

    es.addEventListener('step', (e) => {
      try {
        const d = JSON.parse(e.data);
        setCursorAssessState({
          cursorAssessStep: {
            step: d.step || 0,
            total: d.total || 4,
            label: d.label || '',
            message: d.message || '',
          },
        });
        if (d.message) {
          agentSetStatusMessage(d.message);
          agentPushStep(d.message, 'status');
        }
      } catch (_) {}
    });

    es.addEventListener('status', (e) => {
      try {
        const d = JSON.parse(e.data);
        agentSetStatusMessage(d.message || '');
        if (d.message) agentPushStep(d.message, 'status');
        if (d.rootPath) setCursorAssessState({ cursorAssessFolder: d.rootPath });
      } catch (_) {}
    });

    es.addEventListener('agentActivity', (e) => {
      try {
        const d = JSON.parse(e.data);
        agentPushFile(d);
      } catch (_) {}
    });

    es.addEventListener('fileActivity', (e) => {
      try {
        const d = JSON.parse(e.data);
        setCursorAssessState((s) => {
          const list = s.cursorFileActivity || [];
          if (d.done && list.length) {
            const last = list[list.length - 1];
            const same =
              last.action === d.action &&
              (last.path === d.path || last.pattern === d.pattern);
            if (same && !last.done) {
              const next = [...list];
              next[next.length - 1] = d;
              return { cursorFileActivity: next.slice(-50) };
            }
          }
          return {
            cursorFileActivity: [...list, d].slice(-50),
          };
        });
      } catch (_) {}
    });

    es.addEventListener('output', (e) => {
      try {
        const d = JSON.parse(e.data);
        const t = d.text || '';
        if (t && (d.type || '') === 'thinking') {
          setCursorAssessState((s) => {
            const prev = s.cursorThinkingText || '';
            const needsSpace =
              prev.length > 0 &&
              !/[\s.,;:!?)]$/.test(prev) &&
              !/^[\s.,;:!?(]/.test(t);
            return {
              cursorThinkingText: prev + (needsSpace ? ' ' : '') + t,
            };
          });
        }
      } catch (_) {}
    });

    es.addEventListener('done', (e) => {
      try {
        const d = JSON.parse(e.data);
        es.close();
        agentClearLive();
        setCursorAssessState({
          cursorWaiting: false,
          cursorThinkingText: '',
          cursorAssessPrompt: '',
          cursorAssessStep: { step: 0, total: 4, label: '', message: '' },
        });
        clearAssessStreamProjectId();
        if (d.error) {
          setCursorAssessState({ cursorError: d.error, cursorAssessFolder: '' });
          return;
        }
        setCursorAssessState({ cursorError: null, showAssessCompleteModal: true });
        loadProject(assessStreamProjectId);
      } catch (_) {}
    });

    es.addEventListener('error', (e) => {
      let errMsg = 'Connection lost or server error.';
      if (e.data) {
        try {
          const d = JSON.parse(e.data);
          if (d.error) errMsg = d.error;
        } catch (_) {}
      }
      es.close();
      agentClearLive();
      setCursorAssessState({
        cursorWaiting: false,
        cursorThinkingText: '',
        cursorAssessPrompt: '',
        cursorAssessStep: { step: 0, total: 4, label: '', message: '' },
        cursorAssessFolder: '',
        cursorError: errMsg,
      });
      clearAssessStreamProjectId();
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [assessStreamProjectId]);
}
