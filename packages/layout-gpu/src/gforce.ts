import { World } from '@antv/g-webgpu';
import {
  cloneFormatData,
  Edge,
  ForceLayoutOptions,
  formatNumberFn,
  Graph,
  Layout,
  LayoutMapping,
  Node,
  OutNode,
  PointTuple,
} from '@antv/layout';
import { isNumber } from '@antv/util';
import { aveMovementBundle, gForceBundle } from './gforce-shader';
import { arrayToTextureData, buildTextureDataWithTwoEdgeAttr } from './util';

const DEFAULTS_LAYOUT_OPTIONS: Partial<ForceLayoutOptions> = {
  linkDistance: 1,
  nodeStrength: 1000,
  maxIteration: 1000,
  edgeStrength: 200,
  coulombDisScale: 0.005,
  damping: 0.9,
  maxSpeed: 1000,
  minMovement: 0.5,
  interval: 0.02,
  factor: 1,
  gravity: 10,
};

interface FormattedOptions extends ForceLayoutOptions {
  width: number;
  height: number;
  center: PointTuple;
  maxIteration: number;
  gravity: number;
  damping: number;
  maxSpeed: number;
  minMovement: number;
  coulombDisScale: number;
  factor: number;
  interval: number;
  nodeSize: (d?: Node) => number;
  getMass: (d?: Node) => number;
  nodeStrength: (d?: Node) => number;
  edgeStrength: (d?: Edge) => number;
  linkDistance: (edge?: Edge, source?: any, target?: any) => number;
}

/**
 * <zh/> 快速力导向布局
 * 
 * <en/> Fast force-directed layout
 */
export class GForceLayout implements Layout<ForceLayoutOptions> {
  id = 'gforce';

  constructor(public options: ForceLayoutOptions = {} as ForceLayoutOptions) {
    this.options = {
      ...DEFAULTS_LAYOUT_OPTIONS,
      ...options,
    };
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  async execute(graph: Graph, options?: ForceLayoutOptions) {
    return this.genericForceLayout(false, graph, options);
  }
  /**
   * To directly assign the positions to the nodes.
   */
  async assign(graph: Graph, options?: ForceLayoutOptions) {
   await this.genericForceLayout(true, graph, options);
  }

  private async genericForceLayout(
    assign: false,
    graph: Graph,
    options?: ForceLayoutOptions,
  ): Promise<LayoutMapping>;
  private async genericForceLayout(
    assign: true,
    graph: Graph,
    options?: ForceLayoutOptions,
  ): Promise<void>;
  private async genericForceLayout(
    assign: boolean,
    graph: Graph,
    options?: ForceLayoutOptions,
  ): Promise<LayoutMapping | void> {
    const formattedOptions = this.formatOptions(options, graph);
    const {
      width,
      height,
      center,
      gravity,
      linkDistance,
      edgeStrength,
      getMass,
      getCenter,
      nodeStrength,
      damping,
      maxSpeed,
      minMovement,
      coulombDisScale,
      factor,
      interval,
      maxIteration,
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
    layoutNodes.forEach((node, i) => {
      if (!isNumber(node.data.x)) node.data.x = Math.random() * width;
      if (!isNumber(node.data.y)) node.data.y = Math.random() * height;
    });

    const numParticles = layoutNodes.length;

    const { maxEdgePerVetex, array: nodesEdgesArray } =
      buildTextureDataWithTwoEdgeAttr(
        layoutNodes,
        edges,
        linkDistance,
        edgeStrength,
      );

    const masses: number[] = [];
    const nodeStrengths: number[] = [];
    const centerXs: number[] = [];
    const centerYs: number[] = [];
    const centerGravities: number[] = [];
    const fxs: number[] = [];
    const fys: number[] = [];
    const degrees = layoutNodes.map((node) => graph.getDegree(node.id, 'both'));

    layoutNodes.forEach((node, i) => {
      masses.push(getMass(node));
      nodeStrengths.push(nodeStrength(node));

      let nodeGravity = [center[0], center[1], gravity];
      if (getCenter) {
        const customCenter = getCenter(node, degrees[i]);
        if (
          customCenter &&
          isNumber(customCenter[0]) &&
          isNumber(customCenter[1]) &&
          isNumber(customCenter[2])
        ) {
          nodeGravity = customCenter;
        }
      }
      centerXs.push(nodeGravity[0]);
      centerYs.push(nodeGravity[1]);
      centerGravities.push(nodeGravity[2]);
      if (isNumber(node.data.fx) && isNumber(node.data.fy)) {
        fxs.push(node.data.fx || 0.001);
        fys.push(node.data.fy || 0.001);
      } else {
        fxs.push(0);
        fys.push(0);
      }
    });

    // 每个节点的额外属性占两个数组各一格，nodeAttributeArray1 中是：mass, degree, nodeSterngth, 0
    const nodeAttributeArray1 = arrayToTextureData([
      masses,
      degrees,
      nodeStrengths,
      fxs,
    ]);
    // nodeAttributeArray2 中是：centerX, centerY, gravity, 0,
    const nodeAttributeArray2 = arrayToTextureData([
      centerXs,
      centerYs,
      centerGravities,
      fys,
    ]);

    const world = World.create({
      // @ts-ignore
      engineOptions: {
        supportCompute: true,
      },
    });

    //最终的预编译代码放入到 gForceShader.ts 中直接引入，不再需要下面三行
    // const compiler = new Compiler();
    // const gForceBundle = compiler.compileBundle(gForceCode);
    // console.log(gForceBundle.toString());

    const initPreviousData = [];
    nodesEdgesArray.forEach((value) => {
      initPreviousData.push(value);
    });
    for (let i = 0; i < 4; i++) {
      initPreviousData.push(0);
    }

    const kernelGForce = world
      .createKernel(gForceBundle)
      .setDispatch([numParticles, 1, 1])
      .setBinding({
        u_Data: nodesEdgesArray, // 节点边输入输出
        u_damping: damping,
        u_maxSpeed: maxSpeed,
        u_minMovement: minMovement,
        u_coulombDisScale: coulombDisScale,
        u_factor: factor,
        u_NodeAttributeArray1: nodeAttributeArray1,
        u_NodeAttributeArray2: nodeAttributeArray2,
        MAX_EDGE_PER_VERTEX: maxEdgePerVetex,
        VERTEX_COUNT: numParticles,
        u_AveMovement: initPreviousData,
        u_interval: interval, // 每次迭代更新，首次设置为 interval，在 onIterationCompleted 中更新
      });

    // const aveMovementBundle = compiler.compileBundle(aveMovementCode);
    // console.log(aveMovementBundle.toString());

    const kernelAveMovement = world
      .createKernel(aveMovementBundle)
      .setDispatch([1, 1, 1])
      .setBinding({
        u_Data: nodesEdgesArray,
        VERTEX_COUNT: numParticles,
        u_AveMovement: [0, 0, 0, 0],
      });

    for (let i = 0; i < maxIteration; i++) {
      // TODO: 似乎都来自 kernelGForce 是一个引用
      // 当前坐标作为下一次迭代的 PreviousData
      // if (i > 0) {
      //   kernelAveMovement.setBinding({
      //     u_PreviousData: kernelGForce
      //   });
      // }

      // eslint-disable-next-line no-await-in-loop
      await kernelGForce.execute();

      // midRes = await kernelGForce.getOutput();

      // 每次迭代完成后
      // 计算平均位移，用于提前终止迭代
      kernelAveMovement.setBinding({
        // @ts-ignore
        u_Data: kernelGForce,
      });

      // eslint-disable-next-line no-await-in-loop
      await kernelAveMovement.execute();

      // 更新衰减函数
      const stepInterval = Math.max(0.02, interval - i * 0.002);
      kernelGForce.setBinding({
        u_interval: stepInterval,
        // @ts-ignore
        u_AveMovement: kernelAveMovement,
      });
    }
    const finalParticleData = await kernelGForce.getOutput();

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
    options: ForceLayoutOptions = {},
    graph: Graph,
  ): FormattedOptions {
    const formattedOptions = {
      ...this.options,
      ...options,
    } as FormattedOptions;
    const { width: propsWidth, height: propsHeight, getMass } = options;

    // === formating width, height, and center =====
    formattedOptions.width =
      !propsWidth && typeof window !== 'undefined'
        ? window.innerWidth
        : (propsWidth as number);
    formattedOptions.height =
      !propsHeight && typeof window !== 'undefined'
        ? window.innerHeight
        : (propsHeight as number);
    if (!options.center) {
      formattedOptions.center = [
        formattedOptions.width / 2,
        formattedOptions.height / 2,
      ];
    }

    // === formating node mass =====
    if (!getMass) {
      formattedOptions.getMass = (d?: Node) => {
        let massWeight = 1;
        if (isNumber(d?.data.mass)) massWeight = d?.data.mass as number;
        const degree = graph.getDegree(d!.id, 'both');
        return !degree || degree < 5 ? massWeight : degree * 5 * massWeight;
      };
    }

    // === formating node / edge strengths =====
    formattedOptions.linkDistance = formatNumberFn(1, options.linkDistance);
    formattedOptions.nodeStrength = formatNumberFn(1, options.nodeStrength);
    formattedOptions.edgeStrength = formatNumberFn(1, options.edgeStrength);

    return formattedOptions;
  }
}
