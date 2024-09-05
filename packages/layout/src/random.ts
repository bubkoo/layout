import type {
  Graph,
  Layout,
  LayoutMapping,
  OutNode,
  PointTuple,
  RandomLayoutOptions,
} from './types';

const DEFAULTS_LAYOUT_OPTIONS: Partial<RandomLayoutOptions> = {
  center: [0, 0],
  width: 300,
  height: 300,
};

/**
 * <zh/> 随机布局
 * 
 * <en/> Random layout
 */
export class RandomLayout implements Layout<RandomLayoutOptions> {
  id = 'random';

  constructor(public options: RandomLayoutOptions = {} as RandomLayoutOptions) {
    this.options = {
      ...DEFAULTS_LAYOUT_OPTIONS,
      ...options,
    };
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  async execute(graph: Graph, options?: RandomLayoutOptions) {
    return this.genericRandomLayout(false, graph, options);
  }
  /**
   * To directly assign the positions to the nodes.
   */
  async assign(graph: Graph, options?: RandomLayoutOptions) {
   await this.genericRandomLayout(true, graph, options);
  }

  private async genericRandomLayout(
    assign: false,
    graph: Graph,
    options?: RandomLayoutOptions,
  ): Promise<LayoutMapping>;
  private async genericRandomLayout(
    assign: true,
    graph: Graph,
    options?: RandomLayoutOptions,
  ): Promise<void>;
  private async genericRandomLayout(
    assign: boolean,
    graph: Graph,
    options?: RandomLayoutOptions,
  ): Promise<LayoutMapping | void> {
    const mergedOptions = { ...this.options, ...options };
    const {
      center: propsCenter,
      width: propsWidth,
      height: propsHeight,
    } = mergedOptions;

    const nodes = graph.getAllNodes();
    const layoutScale = 0.9;
    const width =
      !propsWidth && typeof window !== 'undefined'
        ? window.innerWidth
        : (propsWidth as number);
    const height =
      !propsHeight && typeof window !== 'undefined'
        ? window.innerHeight
        : (propsHeight as number);
    const center = !propsCenter
      ? [width / 2, height / 2]
      : (propsCenter as PointTuple);

    const layoutNodes: OutNode[] = [];
    if (nodes) {
      nodes.forEach((node) => {
        layoutNodes.push({
          id: node.id,
          data: {
            x: (Math.random() - 0.5) * layoutScale * width + center[0],
            y: (Math.random() - 0.5) * layoutScale * height + center[1],
          },
        });
      });
    }

    if (assign) {
      layoutNodes.forEach((node) =>
        graph.mergeNodeData(node.id, {
          x: node.data.x,
          y: node.data.y,
        }),
      );
    }

    const result = {
      nodes: layoutNodes,
      edges: graph.getAllEdges(),
    };

    return result;
  }
}
