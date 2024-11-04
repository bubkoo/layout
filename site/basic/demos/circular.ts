import type { Canvas } from '@antv/g';
import { Graph } from '@antv/graphlib';
import type { GUI } from 'lil-gui';
import { CircularLayout } from '../../../packages/layout';
import { countries } from '../data';
import { renderNodes } from '../utils';

export function render(canvas: Canvas, gui: GUI) {
  const { nodes, edges } = countries;
  const graph = new Graph({
    nodes,
    edges,
  });

  const circular = new CircularLayout({
    center: [250, 250],
    radius: 200,
  });

  const relayout = async (options = {}) => {
    const positions = await circular.execute(graph, options);
    await renderNodes(canvas, positions);
  };
  relayout();

  const folder = gui.addFolder('params');
  const config = {
    centerX: 250,
    centerY: 250,
    radius: 200,
    startRadius: 0,
    endRadius: 0,
    startAngle: 0,
    endAngle: 2 * Math.PI,
    clockwise: true,
    divisions: 1,
  };
  folder.add(config, 'centerX', 0, 500).onChange((centerX: number) => {
    relayout({ center: [centerX, config.centerY] });
  });

  folder.add(config, 'centerY', 0, 500).onChange((centerY: number) => {
    relayout({ center: [config.centerX, centerY] });
  });

  folder.add(config, 'radius', 0, 500).onChange((radius: number) => {
    relayout({ radius });
  });

  folder.add(config, 'startRadius', 0, 500).onChange((startRadius: number) => {
    relayout({ radius: 0, startRadius, endRadius: config.endRadius });
  });

  folder.add(config, 'endRadius', 0, 500).onChange((endRadius: number) => {
    relayout({ radius: 0, endRadius, startRadius: config.startRadius });
  });

  folder
    .add(config, 'startAngle', 0, 2 * Math.PI)
    .onChange((startAngle: number) => {
      relayout({ startAngle });
    });

  folder
    .add(config, 'endAngle', 0, 2 * Math.PI)
    .onChange((endAngle: number) => {
      relayout({ endAngle });
    });

  folder.add(config, 'clockwise').onChange((clockwise: boolean) => {
    relayout({
      clockwise,
      radius: 0,
      endRadius: config.endRadius,
      startRadius: config.startRadius,
    });
  });

  folder.add(config, 'divisions', 0, 10).onChange((divisions: number) => {
    relayout({ divisions });
  });
}
