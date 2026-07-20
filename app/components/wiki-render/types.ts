export type WikiRenderMode = 'read' | 'edit';

export type WikiRefKind = 'quest' | 'npc' | 'qna';

export type WikiRenderContext = {
  mode: WikiRenderMode;
  readOnly?: boolean;
};