import { World } from '@antv/g-webgpu';
import {
  cloneFormatData,
  FruchtermanLayoutOptions,
  Graph,
  Layout,
  LayoutMapping,
  OutNode,
  PointTuple,
} from '@antv/layout';
import { isNumber } from '@antv/util';
import { clusterBundle, fruchtermanBundle } from './fruchterman-shader';
import { attributesToTextureData, buildTextureData } from './util';

const DEFAULTS_LAYOUT_OPTIONS: Partial<FruchtermanLayoutOptions> = {
  maxIteration: 1000,
  gravity: 10,
  speed: 5,
  clustering: false,
  clusterGravity: 10,
  width: 300,
  height: 300,
  nodeClusterBy: 'cluster',
};
// const SPEED_DIVISOR = 800;

interface FormattedOptions extends FruchtermanLayoutOptions {
  width: number;
  height: number;
  center: PointTuple;
  maxIteration: number;
  nodeClusterBy: string;
  gravity: number;
  speed: number;
}

/**
 * <zh/> Fruchterman 力导向布局（GPU 版）
 *
 * <en/> Fruchterman force-directed layout(GPU)
 */
export class FruchtermanLayout implements Layout<FruchtermanLayoutOptions> {
  id = 'fruchtermanGPU';

  constructor(
    public options: FruchtermanLayoutOptions = {} as FruchtermanLayoutOptions,
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
      width,
      height,
      center,
      clustering,
      clusterGravity,
      nodeClusterBy,
      maxIteration,
      gravity,
      speed,
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
            },
          },
        ],
        edges,
      };
    }

    const layoutNodes: OutNode[] = nodes.map(
      (node) => cloneFormatData(node, [width, height]) as OutNode,
    );

    const area = height * width;
    let maxDisplace = Math.sqrt(area) / 10;
    const k2 = area / (layoutNodes.length + 1);
    const k = Math.sqrt(k2);

    const { array: attributeArray, count: clusterCount } =
      attributesToTextureData([nodeClusterBy], layoutNodes);

    // pushing the fx and fy
    layoutNodes.forEach((node, i) => {
      let fx = 0;
      let fy = 0;
      if (isNumber(node.data.fx) && isNumber(node.data.fy)) {
        fx = node.data.fx || 0.001;
        fy = node.data.fy || 0.001;
      }
      attributeArray[4 * i + 1] = fx;
      attributeArray[4 * i + 2] = fy;
    });

    const numParticles = layoutNodes.length;
    const { maxEdgePerVetex, array: nodesEdgesArray } = buildTextureData(
      layoutNodes,
      edges,
    );

    const world = World.create({
      // @ts-ignore
      engineOptions: {
        supportCompute: true,
      },
    });

    // compile at runtime in dev mode
    // const compiler = new Compiler()
    // const fruchtermanBundle = compiler.compileBundle(fruchtermanCode)
    // const clusterBundle = compiler.compileBundle(clusterCode)

    // use compiled bundle in prod mode
    // console.log(fruchtermanBundle.toString())
    // console.log(clusterBundle.toString())

    const clusterCenters: number[] = [];
    for (let i = 0; i < clusterCount; i++) {
      clusterCenters.push(0, 0, 0, 0);
    }

    const kernelFruchterman = world
      .createKernel(fruchtermanBundle)
      .setDispatch([numParticles, 1, 1])
      .setBinding({
        u_Data: nodesEdgesArray,
        u_K: k,
        u_K2: k2,
        u_Gravity: gravity,
        u_ClusterGravity: clusterGravity || gravity || 1,
        u_Speed: speed,
        u_MaxDisplace: maxDisplace,
        u_Clustering: clustering ? 1 : 0,
        u_Center: center,
        u_AttributeArray: attributeArray,
        u_ClusterCenters: clusterCenters,
        MAX_EDGE_PER_VERTEX: maxEdgePerVetex,
        VERTEX_COUNT: numParticles,
      });

    let kernelCluster: any;
    if (clustering) {
      kernelCluster = world
        .createKernel(clusterBundle)
        .setDispatch([clusterCount, 1, 1])
        .setBinding({
          u_Data: nodesEdgesArray,
          u_NodeAttributes: attributeArray,
          u_ClusterCenters: clusterCenters,
          VERTEX_COUNT: numParticles,
          CLUSTER_COUNT: clusterCount,
        });
    }

    for (let i = 0; i < maxIteration; i++) {
      // eslint-disable-next-line no-await-in-loop
      await kernelFruchterman.execute();

      if (clustering) {
        kernelCluster.setBinding({
          u_Data: kernelFruchterman,
        });
        // eslint-disable-next-line no-await-in-loop
        await kernelCluster.execute();
        kernelFruchterman.setBinding({
          u_ClusterCenters: kernelCluster,
        });
      }

      kernelFruchterman.setBinding({
        u_MaxDisplace: (maxDisplace *= 0.99),
      });
    }

    const finalParticleData = await kernelFruchterman.getOutput();

    layoutNodes.forEach((node, i) => {
      node.data.x = finalParticleData[4 * i];
      node.data.y = finalParticleData[4 * i + 1];
    });

    if (assign) {
      layoutNodes.forEach(({ id, data }) =>
        graph.mergeNodeData(id, {
          x: data.x,
          y: data.y,
        }),
      );
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
