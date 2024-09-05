import {
  cloneFormatData,
  ForceLayoutOptions,
  Graph,
  Layout,
  LayoutMapping,
  OutNode,
  OutNodeData,
} from '@antv/layout';
import { isNumber } from '@antv/util';
import type { WASMLayoutOptions } from './interface';
import { distanceThresholdMode2Index, graphlib2WASMInput } from './util';

const DEFAULTS_LAYOUT_OPTIONS: Partial<ForceLayoutOptions> = {
  maxIteration: 500,
  gravity: 10,
  factor: 1,
  edgeStrength: 200,
  nodeStrength: 1000,
  coulombDisScale: 0.005,
  damping: 0.9,
  maxSpeed: 500,
  minMovement: 0.4,
  interval: 0.02,
  linkDistance: 200,
  clusterNodeStrength: 20,
  preventOverlap: true,
  distanceThresholdMode: 'mean',
  maxDistance: Infinity,
};

interface WASMForceLayoutOptions
  extends ForceLayoutOptions,
    WASMLayoutOptions {}

/**
 * <zh/> 力导向布局（WASM 版）
 * 
 * <en/> Force-directed layout(WASM)
 */
export class ForceLayout implements Layout<WASMForceLayoutOptions> {
  id = 'forceWASM';

  constructor(
    public options: WASMForceLayoutOptions = {} as WASMForceLayoutOptions,
  ) {
    this.options = {
      ...DEFAULTS_LAYOUT_OPTIONS,
      ...options,
    };
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  async execute(graph: Graph, options?: WASMForceLayoutOptions) {
    return this.genericForceLayout(false, graph, options);
  }
  /**
   * To directly assign the positions to the nodes.
   */
  async assign(graph: Graph, options?: WASMForceLayoutOptions) {
   await this.genericForceLayout(true, graph, options);
  }

  private async genericForceLayout(
    assign: false,
    graph: Graph,
    options?: WASMForceLayoutOptions,
  ): Promise<LayoutMapping>;
  private async genericForceLayout(
    assign: true,
    graph: Graph,
    options?: WASMForceLayoutOptions,
  ): Promise<void>;
  private async genericForceLayout(
    assign: boolean,
    graph: Graph,
    options?: WASMForceLayoutOptions,
  ): Promise<LayoutMapping | void> {
    const formattedOptions = this.formatOptions(options);
    const {
      threads,
      dimensions,
      width,
      height,
      center,
      maxIteration,
      minMovement,
      distanceThresholdMode,
      gravity,
      factor,
      interval,
      damping,
      maxSpeed,
      edgeStrength,
      linkDistance,
      nodeStrength,
      coulombDisScale,
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
    layoutNodes.forEach((node) => {
      if (!isNumber(node.data.x)) node.data.x = Math.random() * width;
      if (!isNumber(node.data.y)) node.data.y = Math.random() * height;
      if (dimensions === 3) {
        if (!isNumber(node.data.z))
          node.data.z = Math.random() * Math.sqrt(width * height);
      }
    });

    const wasmInput = graphlib2WASMInput(layoutNodes, edges, dimensions);

    const { nodes: positions } = await threads.force2({
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
      edge_strength: edgeStrength as number,
      link_distance: linkDistance as number,
      node_strength: nodeStrength as number,
      coulomb_dis_scale: coulombDisScale,
      kg: gravity,
      factor,
      interval,
      damping,
      max_speed: maxSpeed,
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

  /**
   * Format the options.
   * @param options input options
   * @param nodeNum number of nodes
   * @returns formatted options
   */
  private formatOptions(
    options: ForceLayoutOptions = {},
  ): WASMForceLayoutOptions {
    const mergedOptions = {
      ...this.options,
      ...options,
    } as WASMForceLayoutOptions;
    const { center, width, height } = mergedOptions;
    mergedOptions.width =
      !width && typeof window !== 'undefined' ? window.innerWidth : width;
    mergedOptions.height =
      !height && typeof window !== 'undefined' ? window.innerHeight : height;
    mergedOptions.center = !center
      ? [mergedOptions.width / 2, mergedOptions.height / 2]
      : center;
    return mergedOptions;
  }
}
