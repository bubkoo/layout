import { Matrix as MLMatrix, SingularValueDecomposition } from 'ml-matrix';
import type {
  Graph,
  Layout,
  LayoutMapping,
  Matrix,
  MDSLayoutOptions,
  OutNode,
  PointTuple,
} from './types';
import {
  cloneFormatData,
  floydWarshall,
  getAdjMatrix,
  scaleMatrix,
} from './util';
import { handleSingleNodeGraph } from './util/common';

const DEFAULTS_LAYOUT_OPTIONS: Partial<MDSLayoutOptions> = {
  center: [0, 0],
  linkDistance: 50,
};

/**
 * <zh/> 多维缩放算法布局
 *
 * <en/> Multidimensional scaling layout
 */
export class MDSLayout implements Layout<MDSLayoutOptions> {
  id = 'mds';

  constructor(public options: MDSLayoutOptions = {} as MDSLayoutOptions) {
    this.options = {
      ...DEFAULTS_LAYOUT_OPTIONS,
      ...options,
    };
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  async execute(graph: Graph, options?: MDSLayoutOptions) {
    return this.genericMDSLayout(false, graph, options);
  }
  /**
   * To directly assign the positions to the nodes.
   */
  async assign(graph: Graph, options?: MDSLayoutOptions) {
    await this.genericMDSLayout(true, graph, options);
  }

  private async genericMDSLayout(
    assign: false,
    graph: Graph,
    options?: MDSLayoutOptions,
  ): Promise<LayoutMapping>;
  private async genericMDSLayout(
    assign: true,
    graph: Graph,
    options?: MDSLayoutOptions,
  ): Promise<void>;
  private async genericMDSLayout(
    assign: boolean,
    graph: Graph,
    options?: MDSLayoutOptions,
  ): Promise<LayoutMapping | void> {
    const mergedOptions = { ...this.options, ...options };
    const { center = [0, 0], linkDistance = 50 } = mergedOptions;

    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    if (!nodes?.length || nodes.length === 1) {
      return handleSingleNodeGraph(graph, assign, center);
    }

    // the graph-theoretic distance (shortest path distance) matrix
    const adjMatrix = getAdjMatrix({ nodes, edges }, false);
    const distances = floydWarshall(adjMatrix);
    handleInfinity(distances);

    // scale the ideal edge length acoording to linkDistance
    const scaledD = scaleMatrix(distances, linkDistance);

    // get positions by MDS
    const positions = runMDS(scaledD);
    const layoutNodes: OutNode[] = [];
    positions.forEach((p: number[], i: number) => {
      const cnode = cloneFormatData(nodes[i]) as OutNode;
      cnode.data.x = p[0] + center[0];
      cnode.data.y = p[1] + center[1];
      layoutNodes.push(cnode);
    });

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
      edges,
    };

    return result;
  }
}

const handleInfinity = (distances: Matrix[]) => {
  let maxDistance = -999999;
  distances.forEach((row) => {
    row.forEach((value) => {
      if (value === Infinity) {
        return;
      }
      if (maxDistance < value) {
        maxDistance = value;
      }
    });
  });
  distances.forEach((row, i) => {
    row.forEach((value, j) => {
      if (value === Infinity) {
        distances[i][j] = maxDistance;
      }
    });
  });
};

/**
 * mds 算法
 * @return {array} positions 计算后的节点位置数组
 */
const runMDS = (distances: Matrix[]): PointTuple[] => {
  const dimension = 2;

  // square distances
  const M = MLMatrix.mul(MLMatrix.pow(distances, 2), -0.5);

  // double centre the rows/columns
  const rowMeans = M.mean('row');
  const colMeans = M.mean('column');
  const totalMean = M.mean();
  M.add(totalMean).subRowVector(rowMeans).subColumnVector(colMeans);

  // take the SVD of the double centred matrix, and return the
  // points from it
  const ret = new SingularValueDecomposition(M);
  const eigenValues = MLMatrix.sqrt(ret.diagonalMatrix).diagonal();
  return ret.leftSingularVectors.toJSON().map((row: number[]) => {
    return MLMatrix.mul([row], [eigenValues])
      .toJSON()[0]
      .splice(0, dimension) as PointTuple;
  });
};
