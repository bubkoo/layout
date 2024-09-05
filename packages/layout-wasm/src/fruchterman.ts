import {
  cloneFormatData,
  FruchtermanLayoutOptions,
  Graph,
  Layout,
  LayoutMapping,
  OutNode,
  OutNodeData,
  PointTuple,
} from '@antv/layout';
import { isNumber } from '@antv/util';
import type { WASMLayoutOptions } from './interface';
import { distanceThresholdMode2Index, graphlib2WASMInput } from './util';

const DEFAULTS_LAYOUT_OPTIONS: Partial<FruchtermanLayoutOptions> = {
  maxIteration: 1000,
  gravity: 10,
  speed: 5,
  clustering: false,
  clusterGravity: 10,
  width: 300,
  height: 300,
  nodeClusterBy: 'cluster',
  maxDistance: Infinity,
};

interface WASMFruchtermanLayoutOptions
  extends FruchtermanLayoutOptions,
    WASMLayoutOptions {}

interface FormattedOptions extends WASMFruchtermanLayoutOptions {
  width: number;
  height: number;
  center: PointTuple;
  maxIteration: number;
  nodeClusterBy: string;
  gravity: number;
  speed: number;
}

/**
 * <zh/> Fruchterman 力导向布局（WASM 版）
 * 
 * <en/> Fruchterman force-directed layout(WASM)
 */
export class FruchtermanLayout implements Layout<WASMFruchtermanLayoutOptions> {
  id = 'fruchtermanWASM';

  constructor(
    public options: WASMFruchtermanLayoutOptions = {} as WASMFruchtermanLayoutOptions,
  ) {
    this.options = {
      ...DEFAULTS_LAYOUT_OPTIONS,
      ...options,
    };
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  async execute(graph: Graph, options?: FruchtermanLayoutOptions) {
    return this.genericFruchtermanLayout(false, graph, options);
  }
  /**
   * To directly assign the positions to the nodes.
   */
  async assign(graph: Graph, options?: FruchtermanLayoutOptions) {
   await this.genericFruchtermanLayout(true, graph, options);
  }

  private async genericFruchtermanLayout(
    assign: false,
    graph: Graph,
    options?: FruchtermanLayoutOptions,
  ): Promise<LayoutMapping>;
  private async genericFruchtermanLayout(
    assign: true,
    graph: Graph,
    options?: FruchtermanLayoutOptions,
  ): Promise<void>;
  private async genericFruchtermanLayout(
    assign: boolean,
    graph: Graph,
    options?: FruchtermanLayoutOptions,
  ): Promise<LayoutMapping | void> {
    const formattedOptions = this.formatOptions(options);
    const {
      threads,
      dimensions,
      width,
      height,
      center,
      // clustering,
      // clusterGravity,
      // nodeClusterBy,
      maxIteration,
      minMovement,
      distanceThresholdMode,
      gravity,
      speed,
      maxDistance,
    } = formattedOptions;

    let nodes = graph.getAllNodes();
    let edges = graph.getAllEdges();

    if (!nodes?.length) {
      return { nodes: [], edges };
    }

    if (nodes.length === 1) {
      if (assign) {
        graph.mergeNodeData(nodes[0].id, {
          x: center[0],
          y: center[1],
          z: dimensions === 3 ? center[2] : undefined,
        });
      }
      return {
        nodes: [
          {
            ...nodes[0],
            data: {
              ...nodes[0].data,
              x: center[0],
              y: center[1],
              z: dimensions === 3 ? center[2] : undefined,
            },
          },
        ],
        edges,
      };
    }

    const layoutNodes: OutNode[] = nodes.map(
      (node) => cloneFormatData(node, [width, height]) as OutNode,
    );
    layoutNodes.forEach((node, i) => {
      if (!isNumber(node.data.x)) node.data.x = Math.random() * width;
      if (!isNumber(node.data.y)) node.data.y = Math.random() * height;
      if (dimensions === 3) {
        if (!isNumber(node.data.z))
          node.data.z = Math.random() * Math.sqrt(width * height);
      }
    });

    const wasmInput = graphlib2WASMInput(layoutNodes, edges, dimensions);

    const { nodes: positions } = await threads.fruchterman({
      dimensions,
      nodes: wasmInput.nodes,
      edges: wasmInput.edges,
      masses: wasmInput.masses,
      weights: wasmInput.weights,
      iterations: maxIteration,
      min_movement: minMovement,
      distance_threshold_mode: distanceThresholdMode2Index(
        distanceThresholdMode,
      ),
      center,
      height,
      width,
      kg: gravity,
      speed,
      max_distance: maxDistance,
    });

    layoutNodes.forEach((node, i) => {
      node.data.x = positions[dimensions * i];
      node.data.y = positions[dimensions * i + 1];
      if (dimensions === 3) {
        node.data.z = positions[dimensions * i + 2];
      }
    });

    if (assign) {
      layoutNodes.forEach(({ id, data }) => {
        const nodeData: OutNodeData = {
          x: data.x,
          y: data.y,
        };
        if (dimensions === 3) {
          nodeData.z = data.z;
        }
        graph.mergeNodeData(id, nodeData);
      });
    }

    return { nodes: layoutNodes, edges };
  }

  private formatOptions(
    options: FruchtermanLayoutOptions = {},
  ): FormattedOptions {
    const mergedOptions = { ...this.options, ...options } as FormattedOptions;
    const { clustering, nodeClusterBy } = mergedOptions;

    const {
      center: propsCenter,
      width: propsWidth,
      height: propsHeight,
    } = mergedOptions;
    mergedOptions.width =
      !propsWidth && typeof window !== 'undefined'
        ? window.innerWidth
        : (propsWidth as number);
    mergedOptions.height =
      !propsHeight && typeof window !== 'undefined'
        ? window.innerHeight
        : (propsHeight as number);
    mergedOptions.center = !propsCenter
      ? [mergedOptions.width / 2, mergedOptions.height / 2]
      : (propsCenter as PointTuple);

    mergedOptions.clustering = clustering && !!nodeClusterBy;

    return mergedOptions;
  }
}
