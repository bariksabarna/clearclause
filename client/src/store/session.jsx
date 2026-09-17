import { createContext, useContext, useMemo, useReducer } from 'react';

/**
 * ClearClause session store.
 *
 * Holds everything about the current analysis workflow: the uploaded or pasted
 * document, the tagged clauses, the plain-language summary, detected
 * inconsistencies, chat turns, and the derived lawyer checklist. The server is
 * stateless, so all session content lives here in the browser between calls.
 */

export const initialState = {
  fileName: null,
  documentText: null,
  summary: null,
  clauses: [],
  inconsistencies: [],
  chatTurns: [],
  checklist: null,
  payload: null,
  describing: false,
  completed: false,
  error: null,
};

export function sessionReducer(state, action) {
  switch (action.type) {
    case 'BEGIN_ANALYSIS':
      return {
        ...initialState,
        fileName: action.fileName,
        payload: action.payload,
        describing: true,
      };
    case 'SET_CLAUSES':
      return { ...state, clauses: action.clauses };
    case 'SET_DOCUMENT_TEXT':
      return { ...state, documentText: action.documentText };
    case 'SET_INCONSISTENCIES':
      return { ...state, inconsistencies: action.inconsistencies };
    case 'SET_SUMMARY':
      return { ...state, summary: action.summary };
    case 'COMPLETE_ANALYSIS':
      return { ...state, describing: false, completed: true, error: null };
    case 'FAIL_ANALYSIS':
      return { ...state, describing: false, error: action.error };
    case 'APPEND_CHAT':
      return { ...state, chatTurns: [...state.chatTurns, action.turn] };
    case 'SET_CHECKLIST':
      return { ...state, checklist: action.checklist };
    case 'RESET_SESSION':
      return { ...initialState };
    default:
      return state;
  }
}

export function beginAnalysis(fileName, payload) {
  return { type: 'BEGIN_ANALYSIS', fileName, payload };
}
export function setClauses(clauses) {
  return { type: 'SET_CLAUSES', clauses };
}
export function setDocumentText(documentText) {
  return { type: 'SET_DOCUMENT_TEXT', documentText };
}
export function setInconsistencies(inconsistencies) {
  return { type: 'SET_INCONSISTENCIES', inconsistencies };
}
export function setSummary(summary) {
  return { type: 'SET_SUMMARY', summary };
}
export function completeAnalysis() {
  return { type: 'COMPLETE_ANALYSIS' };
}
export function failAnalysis(error) {
  return { type: 'FAIL_ANALYSIS', error };
}
export function appendChat(turn) {
  return { type: 'APPEND_CHAT', turn };
}
export function setChecklist(checklist) {
  return { type: 'SET_CHECKLIST', checklist };
}
export function resetSession() {
  return { type: 'RESET_SESSION' };
}

export const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
