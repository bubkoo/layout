import { Graph } from '@antv/graphlib';
import type { LayoutMapping } from '@antv/layout';
import { ComboCombinedLayout } from '@antv/layout';
import type { Test } from 'iperf';

export const comboCombined: Test = async ({ perf, container }) => {
  const data = await fetch(
    'https://assets.antv.antgroup.com/g6/combo.json',
  ).then((res) => res.json());

  const nodes = [
    ...data.nodes.map((node: any) => ({
      ...node,
      data: { _isCombo: false },
    })),
    ...data.combos.map((combo: any) => ({
      ...combo,
      data: { _isCombo: true },
    })),
  ];
  const edges = data.edges.map((edge: any) => ({
    ...edge,
    id: `${edge.source}-${edge.target}`,
  }));

  const graph = new Graph({ nodes, edges });
  graph.attachTreeStructure('combo');
  data.nodes.forEach((node: any) => {
    if (node.combo) graph.setParent(node.id, node.combo, 'combo');
  });

  const layout = new ComboCombinedLayout({});

  let result: LayoutMapping;

  await perf.evaluate('combo combined', async () => {
    result = await layout.execute(graph);
  });

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const [width, height] = [500, 500];
  canvas.width = width;
  canvas.height = height;

  result.nodes.forEach((node) => {
    const {
      data: { x, y },
    } = node;
    ctx.beginPath();
    ctx.arc(x + 200, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
};
