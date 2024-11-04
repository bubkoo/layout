import type { Canvas } from '@antv/g';
import { Graph } from '@antv/graphlib';
import { ConcentricLayout } from '../../../packages/layout';
import { countries } from '../data';
import { renderNodes } from '../utils';

export function render(canvas: Canvas) {
  const { nodes, edges } = countries;
  const graph = new Graph({
    nodes,
    edges,
  });

  const concentric = new ConcentricLayout({
    maxLevelDiff: 0.5,
    center: [200, 200],
    width: 400,
    height: 400,
  });

  (async () => {
    const positions = await concentric.execute(graph);
    await renderNodes(canvas, positions);
  })();
}
