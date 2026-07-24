'use client';

import React from 'react';
import {
  Node,
  Text,
} from 'slate';

import {
  DividerBlock,
  InfoBoxBlock,
  ParagraphBlock,
} from '@/components/wiki-render';
import {
  getInfoBoxAlignmentPrefix,
  processInfoBoxLegacyIndentChunk,
} from '@/components/wiki-render/blocks/InfoBoxBlock';
import {
  resolveDividerStyle,
  resolveInfoBoxNoIcon,
  resolveInfoBoxTone,
} from '@/components/wiki-render/blocks/blockNodeUtils';

import {
  normalizeInfoBoxNodeForMobile,
  stripReact,
} from '../readRendererUtils';

import type {
  ReadRenderEnv,
  ReadRenderNode,
} from './types';

type ParagraphReadAdapterProps = {
  node: any;
  children: React.ReactNode;
  env?: ReadRenderEnv;
};

export function ParagraphReadAdapter({
  node,
  children,
  env,
}: ParagraphReadAdapterProps) {
  const plainText =
    stripReact(children)
      .replace(/\u200B/g, '')
      .trim();

  const isMobileTableText =
    Boolean(
      env?.isMobile &&
      env?.inTableCell,
    );

  return (
    <ParagraphBlock
      mode="read"
      textAlign={node.textAlign}
      indentLine={
        Boolean(node.indentLine)
      }
      plainText={plainText}
      isEmpty={
        plainText.length === 0
      }
      isMobileTableText={
        isMobileTableText
      }
    >
      {children}
    </ParagraphBlock>
  );
}

type DividerReadAdapterProps = {
  node: any;
};

export function DividerReadAdapter({
  node,
}: DividerReadAdapterProps) {
  return (
    <DividerBlock
      mode="read"
      styleType={
        resolveDividerStyle(node)
      }
    />
  );
}

function normalizeLegacyInfoBoxIndent(
  node: any,
) {
  const plainText =
    Node.string(node);

  if (
    !getInfoBoxAlignmentPrefix(
      plainText,
    )
  ) {
    return node;
  }

  let afterLineBreak = false;

  const visit = (
    value: any,
  ): any => {
    if (Text.isText(value)) {
      const result =
        processInfoBoxLegacyIndentChunk(
          value.text,
          afterLineBreak,
        );

      afterLineBreak =
        result.afterLineBreak;

      if (
        result.text ===
        value.text
      ) {
        return value;
      }

      return {
        ...value,
        text: result.text,
      };
    }

    if (
      Array.isArray(
        value?.children,
      )
    ) {
      return {
        ...value,
        children:
          value.children.map(
            visit,
          ),
      };
    }

    return value;
  };

  return visit(node);
}

type InfoBoxReadAdapterProps = {
  node: any;
  keyProp?: React.Key;
  ctx?: any;
  handlers?: any;
  env?: ReadRenderEnv;
  renderNode: ReadRenderNode;
};

export function InfoBoxReadAdapter({
  node,
  keyProp,
  ctx,
  handlers,
  env,
  renderNode,
}: InfoBoxReadAdapterProps) {
  const displayNode =
    normalizeLegacyInfoBoxIndent(
      node,
    );

  const sourceChildren =
    env?.isMobile
      ? (
          displayNode.children ??
          []
        ).map(
          normalizeInfoBoxNodeForMobile,
        )
      : displayNode.children ?? [];

  const infoChildren =
    sourceChildren.map(
      (
        child: any,
        index: number,
      ) =>
        renderNode(
          child,
          keyProp
            ? `${keyProp}-info-${index}`
            : index,
          ctx,
          handlers,
          env,
        ),
    );

  return (
    <InfoBoxBlock
      mode="read"
      tone={
        resolveInfoBoxTone(node)
      }
      noIcon={
        resolveInfoBoxNoIcon(node)
      }
      plainText={
        Node.string(displayNode)
      }
    >
      {infoChildren}
    </InfoBoxBlock>
  );
}
