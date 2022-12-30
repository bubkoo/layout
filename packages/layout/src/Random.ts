import { Graph } from "@antv/graphlib";
import { Node, Edge, LayoutMapping, OutNode, PointTuple, RandomLayoutOptions, SyncLayout } from "./types";

const DEFAULTS_LAYOUT_OPTIONS: Partial<RandomLayoutOptions> = {
  center: [0, 0],
  width: 300,
  height: 300
}

/**
 * Layout randomizing the nodes' position
 * 
 * @example
 * // Assign layout options when initialization.
 * const layout = new RandomLayout({ center: [100, 100] });
 * const positions = layout.execute(graph); // { nodes: [], edges: [] }
 * 
 * // Or use different options later.
 * const layout = new RandomLayout({ center: [100, 100] });
 * const positions = layout.execute(graph, { center: [100, 100] }); // { nodes: [], edges: [] }
 * 
 * // If you want to assign the positions directly to the nodes, use assign method.
 * layout.assign(graph, { center: [100, 100] });
 */
export class RandomLayout implements SyncLayout<RandomLayoutOptions> {
  constructor(private options: RandomLayoutOptions = {} as RandomLayoutOptions) {
    Object.assign(this.options, DEFAULTS_LAYOUT_OPTIONS, options);
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  execute(graph: Graph<Node, Edge>, options?: RandomLayoutOptions): LayoutMapping {
    return this.genericRandomLayout(false, graph, options) as LayoutMapping;
  }
  /**
   * To directly assign the positions to the nodes.
   */
  assign(graph: Graph<Node, Edge>, options?: RandomLayoutOptions) {
    this.genericRandomLayout(true, graph, options);
  }

  private genericRandomLayout(assign: boolean, graph: Graph<Node, Edge>, options?: RandomLayoutOptions): LayoutMapping | void {
    const mergedOptions = { ...this.options, ...options };
    const { center: propsCenter, width: propsWidth, height: propsHeight, layoutInvisibles } = mergedOptions;

    let nodes = graph.getAllNodes();
    if (!layoutInvisibles) nodes = nodes.filter(node => node.visible || node.visible === undefined);
    const layoutScale = 0.9;
    const width = !propsWidth && typeof window !== "undefined" ? window.innerWidth : propsWidth as number;
    const height = !propsHeight && typeof window !== "undefined" ? window.innerHeight : propsHeight as number;
    const center = !propsCenter ? [width / 2, height / 2] : propsCenter as PointTuple;

    const layoutNodes: OutNode[] = [];
    if (nodes) {
      nodes.forEach((node) => {
        layoutNodes.push({
          id: node.id,
          x: (Math.random() - 0.5) * layoutScale * width + center[0],
          y: (Math.random() - 0.5) * layoutScale * height + center[1],
        });
      });
    }

    if (assign) {
      layoutNodes.forEach(node => graph.mergeNodeData(node.id, {
        x: node.x,
        y: node.y
      }))
    }

    onLayoutEnd?.();

    return {
      nodes,
      edges: graph.getAllEdges()
    };
  }
}