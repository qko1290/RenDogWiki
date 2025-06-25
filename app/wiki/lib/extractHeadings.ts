import { Descendant } from 'slate';

export function extractHeadings(value: Descendant[]) {
  const result: { id: string; level: number; text: string; icon?: string }[] = [];

  const visit = (nodes: Descendant[]) => {
    for (const node of nodes) {
      if ('type' in node && node.type?.startsWith('heading')) {
        const level = node.type === 'heading-one' ? 1 : node.type === 'heading-two' ? 2 : 3;
        const text = node.children.map((c: any) => c.text).join('');
        const id = 'heading-' + text
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase();

        result.push({
          id,
          level,
          text,
          icon: (node as any).icon || '',
        });
      }

      if ('children' in node) visit(node.children as Descendant[]);
    }
  };

  visit(value);
  return result;
}
