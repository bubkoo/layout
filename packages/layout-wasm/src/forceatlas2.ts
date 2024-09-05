import {
  cloneFormatData,
  ForceAtlas2LayoutOptions,
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

const DEFAULTS_LAYOUT_OPTIONS: Partial<ForceAtlas2LayoutOptions> = {
  center: [0, 0],
  width: 300,
  height: 300,
  kr: 5,
  kg: 1,
  mode: 'normal',
  preventOverlap: false,
  dissuadeHubs: false,
  maxIteration: 0,
  ks: 0.1,
  ksmax: 10,
  tao: 0.1,
  maxDistance: Infinity,
};

interface FormattedOptions extends WASMForceAtlas2LayoutOptions {
  width: number;
  height: number;
  maxIteration: number;
  center: PointTuple;
  kr: number;
  kg: number;
  ks: number;
  ksmax: number;
  tao: number;
}

interface WASMForceAtlas2LayoutOptions
  extends ForceAtlas2LayoutOptions,
    WASMLayoutOptions {}

interface FormattedOptions extends WASMForceAtlas2LayoutOptions {
  width: number;
  height: number;
  center: PointTuple;
  maxIteration: number;
  nodeClusterBy: string;
  gravity: number;
  speed: number;
}
/**
 * <zh/> Atlas2 力导向布局（WASM 版）
 *
 * <en/> Force Atlas 2 layout(WASM)
 */
export class ForceAtlas2Layout implements Layout<WASMForceAtlas2LayoutOptions> {
  id = 'forceAtlas2WASM';

  constructor(
    public options: WASMForceAtlas2LayoutOptions = {} as WASMForceAtlas2LayoutOptions,
  ) {
    this.options = {
      ...DEFAULTS_LAYOUT_OPTIONS,
      ...options,
    };
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  async execute(graph: Graph, options?: ForceAtlas2LayoutOptions) {
    return this.genericForceAtlas2Layout(false, graph, options);
  }
  /**
   * To directly assign the positions to the nodes.
   */
  async assign(graph: Graph, options?: ForceAtlas2LayoutOptions) {
    await this.genericForceAtlas2Layout(true, graph, options);
  }

  private async genericForceAtlas2Layout(
    assign: false,
    graph: Graph,
    options?: ForceAtlas2LayoutOptions,
  ): Promise<LayoutMapping>;
  private async genericForceAtlas2Layout(
    assign: true,
    graph: Graph,
    options?: ForceAtlas2LayoutOptions,
  ): Promise<void>;
  private async genericForceAtlas2Layout(
    assign: boolean,
    graph: Graph,
    options?: ForceAtlas2LayoutOptions,
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
      tao,
      kr,
      kg,
      ks,
      dissuadeHubs,
      mode,
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

    const { nodes: positions } = await threads.forceatlas2({
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
      ka: 1.0,
      kg,
      kr,
      speed: ks,
      prevent_overlapping: false,
      node_radius: 10,
      kr_prime: 10,
      strong_gravity: false,
      lin_log: mode === 'linlog',
      dissuade_hubs: dissuadeHubs,
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
    options: ForceAtlas2LayoutOptions = {},
  ): FormattedOptions {
    const mergedOptions = { ...this.options, ...options } as FormattedOptions;
    const { center, width, height, barnesHut, prune, maxIteration, kr, kg } =
      mergedOptions;
    mergedOptions.width =
      !width && typeof window !== 'undefined' ? window.innerWidth : width;
    mergedOptions.height =
      !height && typeof window !== 'undefined' ? window.innerHeight : height;
    mergedOptions.center = !center
      ? [mergedOptions.width / 2, mergedOptions.height / 2]
      : center;

    // if (barnesHut === undefined && nodeNum > 250) {
    //   mergedOptions.barnesHut = true;
    // }
    // if (prune === undefined && nodeNum > 100) mergedOptions.prune = true;
    // if (maxIteration === 0 && !prune) {
    //   mergedOptions.maxIteration = 250;
    //   if (nodeNum <= 200 && nodeNum > 100) mergedOptions.maxIteration = 1000;
    //   else if (nodeNum > 200) mergedOptions.maxIteration = 1200;
    // } else if (maxIteration === 0 && prune) {
    //   mergedOptions.maxIteration = 100;
    //   if (nodeNum <= 200 && nodeNum > 100) mergedOptions.maxIteration = 500;
    //   else if (nodeNum > 200) mergedOptions.maxIteration = 950;
    // }

    // if (!kr) {
    //   mergedOptions.kr = 50;
    //   if (nodeNum > 100 && nodeNum <= 500) mergedOptions.kr = 20;
    //   else if (nodeNum > 500) mergedOptions.kr = 1;
    // }
    // if (!kg) {
    //   mergedOptions.kg = 20;
    //   if (nodeNum > 100 && nodeNum <= 500) mergedOptions.kg = 10;
    //   else if (nodeNum > 500) mergedOptions.kg = 1;
    // }

    return mergedOptions;
  }
}
