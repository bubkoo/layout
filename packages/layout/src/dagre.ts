import { isFunction, isNumber } from '@antv/util';
import type { EdgeConfig, GraphLabel, NodeConfig } from 'dagre';
import dagre, { graphlib } from 'dagre';
import type { Graph, Layout, LayoutMapping, Node } from './types';
import { parseSize, type Size } from './util/size';

export interface DagreLayoutOptions extends GraphLabel, NodeConfig, EdgeConfig {
  nodeSize?: Size | ((node: Node) => Size);
}

/**
 * <zh/> Dagre 布局
 * 
 * <en/> Dagre layout
 */
export class DagreLayout implements Layout<DagreLayoutOptions> {
  static defaultOptions: Partial<DagreLayoutOptions> = {};

  public id = 'dagre';

  public options: Partial<DagreLayoutOptions> = {};

  constructor(options: Partial<DagreLayoutOptions>) {
    Object.assign(this.options, DagreLayout.defaultOptions, options);
  }

  async execute(
    graph: Graph,
    options?: DagreLayoutOptions,
  ): Promise<LayoutMapping> {
    return this.genericDagreLayout(false, graph, {
      ...this.options,
      ...options,
    });
  }

  async assign(graph: Graph, options?: DagreLayoutOptions): Promise<void> {
    await this.genericDagreLayout(true, graph, { ...this.options, ...options });
  }

  private async genericDagreLayout(
    assign: boolean,
    graph: Graph,
    options?: DagreLayoutOptions,
  ) {
    const { nodeSize } = options;
    const g = new graphlib.Graph();
    g.setGraph(options);
    g.setDefaultEdgeLabel(() => ({}));

    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    if ([...nodes, ...edges].some(({ id }) => isNumber(id))) {
      console.error(
        'Dagre layout only support string id, it will convert number to string.',
      );
    }

    graph.getAllNodes().forEach((node) => {
      const { id } = node;
      const data = { ...node.data };
      if (nodeSize !== undefined) {
        const [width, height] = parseSize(
          isFunction(nodeSize) ? nodeSize(node) : nodeSize,
        );
        Object.assign(data, { width, height });
      }
      g.setNode(id.toString(), data);
    });
    graph.getAllEdges().forEach(({ id, source, target }) => {
      g.setEdge(source.toString(), target.toString(), { id });
    });

    dagre.layout(g);

    const mapping: LayoutMapping = { nodes: [], edges: [] };

    g.nodes().forEach((id) => {
      const data = g.node(id);
      mapping.nodes.push({ id, data });
      if (assign) graph.mergeNodeData(id, data);
    });

    g.edges().forEach((edge) => {
      const { id, ...data } = g.edge(edge);
      const { v: source, w: target } = edge;
      mapping.edges.push({ id, source, target, data });
      if (assign) graph.mergeEdgeData(id, data);
    });

    return mapping;
  }
}
