export type WikiRenderMode = 'read' | 'edit';

export type WikiRenderContext = {
  mode: WikiRenderMode;
  readOnly?: boolean;
};