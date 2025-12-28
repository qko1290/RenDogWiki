// components/editor/helpers/insertWikiDbEmbed.ts
import type { Editor } from 'slate';
import { Transforms } from 'slate';

export type WikiEmbedKind = 'quest' | 'npc' | 'qna';

export function insertQuestEmbedById(editor: Editor, questId: number) {
  const element: any = {
    type: 'quest-embed',
    questId,
    children: [{ text: '' }],
  };
  Transforms.insertNodes(editor, element);
  Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] } as any);
}

export function insertNpcEmbedById(editor: Editor, npcId: number) {
  const element: any = {
    type: 'npc-embed',
    npcId,
    children: [{ text: '' }],
  };
  Transforms.insertNodes(editor, element);
  Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] } as any);
}

export function insertQnaEmbedById(editor: Editor, qnaId: number) {
  const element: any = {
    type: 'qna-embed',
    qnaId,
    children: [{ text: '' }],
  };
  Transforms.insertNodes(editor, element);
  Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] } as any);
}
