import { Graph as GraphCore, ID } from '@antv/graphlib';
import { isFunction, isNumber, isObject } from '@antv/util';
import { ConcentricLayout } from './concentric';
import { ForceLayout } from './force';
import { MDSLayout } from './mds';
import {
  isLayoutWithIterations,
  type ComboCombinedLayoutOptions,
  type Edge,
  type Graph,
  type Layout,
  type LayoutMapping,
  type Node,
  type OutNode,
} from './types';
import { getLayoutBBox, graphTreeDfs, isArray } from './util';
import { handleSingleNodeGraph } from './util/common';

const FORCE_LAYOUT_TYPE_MAP: { [key: string]: boolean } = {
  gForce: true,
  force2: true,
  d3force: true,
  fruchterman: true,
  forceAtlas2: true,
  force: true,
  'graphin-force': true,
};

const DEFAULTS_LAYOUT_OPTIONS: Partial<ComboCombinedLayoutOptions> = {
  center: [0, 0],
  comboPadding: 10,
  treeKey: 'combo',
};

/**
 * Layout arranging the nodes and combos with combination of inner and outer layouts.
 *
 * @example
 * // Assign layout options when initialization.
 * const layout = new ComboCombinedLayout({});
 * const positions = await layout.execute(graph); // { nodes: [], edges: [] }
 *
 * // Or use different options later.
 * const layout = new ComboCombinedLayout({ radius: 10 });
 * const positions = await layout.execute(graph, { radius: 20 }); // { nodes: [], edges: [] }
 *
 * // If you want to assign the positions directly to the nodes, use assign method.
 * await layout.assign(graph, { radius: 20 });
 */
export class ComboCombinedLayout implements Layout<ComboCombinedLayoutOptions> {
  id = 'comboCombined';

  constructor(
    public options: ComboCombinedLayoutOptions = {} as ComboCombinedLayoutOptions,
  ) {
    this.options = {
      ...DEFAULTS_LAYOUT_OPTIONS,
      ...options,
    };
  }

  /**
   * Return the positions of nodes and edges(if needed).
   */
  async execute(graph: Graph, options?: ComboCombinedLayoutOptions) {
    return this.genericComboCombinedLayout(false, graph, options);
  }

  /**
   * To directly assign the positions to the nodes.
   */
  async assign(graph: Graph, options?: ComboCombinedLayoutOptions) {
    await this.genericComboCombinedLayout(true, graph, options);
  }

  private async genericComboCombinedLayout(
    assign: false,
    graph: Graph,
    options?: ComboCombinedLayoutOptions,
  ): Promise<LayoutMapping>;
  private async genericComboCombinedLayout(
    assign: true,
    graph: Graph,
    options?: ComboCombinedLayoutOptions,
  ): Promise<void>;
  private async genericComboCombinedLayout(
    assign: boolean,
    graph: Graph,
    options?: ComboCombinedLayoutOptions,
  ): Promise<LayoutMapping | void> {
    const mergedOptions = this.initVals({ ...this.options, ...options });
    const { center, treeKey, outerLayout: propsOuterLayout } = mergedOptions;

    const nodes: Node[] = graph
      .getAllNodes()
      .filter((node) => !node.data._isCombo);
    const combos: Node[] = graph
      .getAllNodes()
      .filter((node) => node.data._isCombo);
    const edges: Edge[] = graph.getAllEdges();

    const n = nodes?.length;
    if (!n || n === 1) {
      return handleSingleNodeGraph(graph, assign, center);
    }

    // output nodes
    const layoutNodes: OutNode[] = [];

    const nodeMap: Map<ID, Node> = new Map();
    nodes.forEach((node) => {
      nodeMap.set(node.id, node);
    });
    const comboMap: Map<ID, Node> = new Map();
    combos.forEach((combo) => {
      comboMap.set(combo.id, combo);
    });

    // each one in comboNodes is a combo contains the size and child nodes
    // comboNodes includes the node who has no parent combo
    const comboNodes: Map<ID, Node> = new Map();
    // the inner layouts, the result positions are stored in comboNodes and their child nodes
    const innerGraphLayoutPromises = this.getInnerGraphs(
      graph,
      treeKey,
      nodeMap,
      comboMap,
      edges,
      mergedOptions,
      comboNodes,
    );
    await Promise.all(innerGraphLayoutPromises);

    const outerNodeIds: Map<ID, boolean> = new Map();
    const outerLayoutNodes: Node[] = [];
    const nodeAncestorIdMap: Map<ID, ID> = new Map();
    let allHaveNoPosition = true;
    graph.getRoots(treeKey).forEach((root: Node) => {
      const combo = comboNodes.get(root.id);
      const cacheCombo = comboMap.get(root.id) || nodeMap.get(root.id);
      const comboLayoutNode = {
        id: root.id,
        data: {
          ...root.data,
          x: combo.data.x || cacheCombo.data.x,
          y: combo.data.y || cacheCombo.data.y,
          fx: combo.data.fx || cacheCombo.data.fx,
          fy: combo.data.fy || cacheCombo.data.fy,
          mass: combo.data.mass || cacheCombo.data.mass,
          size: combo.data.size,
        },
      };
      outerLayoutNodes.push(comboLayoutNode);
      outerNodeIds.set(root.id, true);
      if (
        !isNaN(comboLayoutNode.data.x) &&
        comboLayoutNode.data.x !== 0 &&
        !isNaN(comboLayoutNode.data.y) &&
        comboLayoutNode.data.y !== 0
      ) {
        allHaveNoPosition = false;
      } else {
        comboLayoutNode.data.x = Math.random() * 100;
        comboLayoutNode.data.y = Math.random() * 100;
      }
      graphTreeDfs(
        graph,
        [root],
        (child) => {
          if (child.id !== root.id) nodeAncestorIdMap.set(child.id, root.id);
        },
        'TB',
        treeKey,
      );
    });

    const outerLayoutEdges: any = [];
    edges.forEach((edge) => {
      const sourceAncestorId =
        nodeAncestorIdMap.get(edge.source) || edge.source;
      const targetAncestorId =
        nodeAncestorIdMap.get(edge.target) || edge.target;
      // create an edge for outer layout if both source and target's ancestor combo is in outer layout nodes
      if (
        sourceAncestorId !== targetAncestorId &&
        outerNodeIds.has(sourceAncestorId) &&
        outerNodeIds.has(targetAncestorId)
      ) {
        outerLayoutEdges.push({
          id: edge.id,
          source: sourceAncestorId,
          target: targetAncestorId,
          data: {},
        });
      }
    });

    // 若有需要最外层的 combo 或节点，则对最外层执行力导向
    let outerPositions: any;
    if (outerLayoutNodes?.length) {
      if (outerLayoutNodes.length === 1) {
        outerLayoutNodes[0].data.x = center[0];
        outerLayoutNodes[0].data.y = center[1];
      } else {
        const outerLayoutGraph = new GraphCore({
          nodes: outerLayoutNodes,
          edges: outerLayoutEdges,
        });
        const outerLayout = propsOuterLayout || new ForceLayout();
        // preset the nodes if the outerLayout is a force family layout
        if (allHaveNoPosition && FORCE_LAYOUT_TYPE_MAP[outerLayout.id]) {
          const outerLayoutPreset =
            outerLayoutNodes.length < 100
              ? new MDSLayout()
              : new ConcentricLayout();
          await outerLayoutPreset.assign(outerLayoutGraph);
        }

        const options = {
          center,
          kg: 5,
          preventOverlap: true,
          animate: false,
          ...(outerLayout.id === 'force'
            ? {
                gravity: 1,
                factor: 4,
                linkDistance: (edge: Edge, source: Node, target: Node) => {
                  const sourceSize =
                    Math.max(...(source.data.size as number[])) || 32;
                  const targetSize =
                    Math.max(...(target.data.size as number[])) || 32;
                  return sourceSize / 2 + targetSize / 2 + 200;
                },
              }
            : {}),
        };

        outerPositions = await executeLayout(
          outerLayout,
          outerLayoutGraph,
          options,
        );
      }

      // move the combos and their child nodes
      comboNodes.forEach((comboNode: Node) => {
        const outerPosition = outerPositions.nodes.find(
          (pos: Node) => pos.id === comboNode.id,
        );
        if (outerPosition) {
          // if it is one of the outer layout nodes, update the positions
          const { x, y } = outerPosition.data;
          comboNode.data.visited = true;
          comboNode.data.x = x;
          comboNode.data.y = y;
          layoutNodes.push({
            id: comboNode.id,
            data: { x, y },
          });
        }
        // move the child nodes
        const { x, y } = comboNode.data;
        (comboNode.data.nodes as Node[])?.forEach((node: OutNode) => {
          layoutNodes.push({
            id: node.id,
            data: { x: node.data.x + x, y: node.data.y + y },
          });
        });
      });
      // move the nodes from top to bottom
      comboNodes.forEach(({ data }: Node) => {
        const { x, y, visited, nodes } = data;
        (nodes as Node[])?.forEach((node: OutNode) => {
          if (!visited) {
            const layoutNode = layoutNodes.find((n) => n.id === node.id);
            layoutNode.data.x += x || 0;
            layoutNode.data.y += y || 0;
          }
        });
      });
    }

    if (assign) {
      layoutNodes.forEach((node) => {
        graph.mergeNodeData(node.id, {
          x: node.data.x,
          y: node.data.y,
        });
      });
    }

    const result = {
      nodes: layoutNodes,
      edges,
    };

    return result;
  }

  private initVals(options: ComboCombinedLayoutOptions) {
    const formattedOptions = { ...options };
    const { nodeSize, spacing, comboPadding } = options;
    let nodeSizeFunc: (d: any) => number;
    let spacingFunc: (d: any) => number;

    // nodeSpacing to function
    if (isNumber(spacing)) {
      spacingFunc = () => spacing as any;
    } else if (isFunction(spacing)) {
      spacingFunc = spacing;
    } else {
      spacingFunc = () => 0;
    }
    formattedOptions.spacing = spacingFunc;

    // nodeSize to function
    if (!nodeSize) {
      nodeSizeFunc = (d) => {
        const spacing = spacingFunc(d);
        if (d.size) {
          if (isArray(d.size)) {
            const res = d.size[0] > d.size[1] ? d.size[0] : d.size[1];
            return (res + spacing) / 2;
          }
          if (isObject(d.size)) {
            const res =
              d.size.width > d.size.height ? d.size.width : d.size.height;
            return (res + spacing) / 2;
          }
          return (d.size + spacing) / 2;
        }
        return 32 + spacing / 2;
      };
    } else if (isFunction(nodeSize)) {
      nodeSizeFunc = (d) => {
        const size = nodeSize(d);
        const spacing = spacingFunc(d);
        if (isArray(d.size)) {
          const res = d.size[0] > d.size[1] ? d.size[0] : d.size[1];
          return (res + spacing) / 2;
        }
        return ((size || 32) + spacing) / 2;
      };
    } else if (isArray(nodeSize)) {
      const larger = nodeSize[0] > nodeSize[1] ? nodeSize[0] : nodeSize[1];
      const radius = larger / 2;
      nodeSizeFunc = (d) => radius + spacingFunc(d) / 2;
    } else {
      // number type
      const radius = nodeSize / 2;
      nodeSizeFunc = (d) => radius + spacingFunc(d) / 2;
    }
    formattedOptions.nodeSize = nodeSizeFunc;

    // comboPadding to function
    let comboPaddingFunc: (d: any) => number;
    if (isNumber(comboPadding)) {
      comboPaddingFunc = () => comboPadding as any;
    } else if (isArray(comboPadding)) {
      comboPaddingFunc = () => Math.max.apply(null, comboPadding);
    } else if (isFunction(comboPadding)) {
      comboPaddingFunc = comboPadding;
    } else {
      // null type
      comboPaddingFunc = () => 0;
    }
    formattedOptions.comboPadding = comboPaddingFunc;
    return formattedOptions;
  }

  private getInnerGraphs(
    graph: Graph,
    treeKey: string,
    nodeMap: Map<ID, Node>,
    comboMap: Map<ID, Node>,
    edges: Edge[],
    options: ComboCombinedLayoutOptions,
    comboNodes: Map<ID, Node>,
  ): Promise<any>[] {
    const { nodeSize, comboPadding, spacing, innerLayout } = options;

    const innerGraphLayout: any = innerLayout || new ConcentricLayout({});
    const innerLayoutOptions = {
      center: [0, 0],
      preventOverlap: true,
      nodeSpacing: spacing,
    };
    const innerLayoutPromises: Promise<any>[] = [];

    const getSize = (node: Node) => {
      // @ts-ignore
      let padding = comboPadding?.(node) || 10;
      if (isArray(padding)) padding = Math.max(...padding);
      return {
        size: padding ? [padding * 2, padding * 2] : [30, 30],
        padding,
      };
    };

    graph.getRoots(treeKey).forEach((root: any) => {
      // @ts-ignore
      comboNodes.set(root.id, {
        id: root.id,
        data: {
          nodes: [],
          size: getSize(root).size,
        },
      });

      let start: Promise<any> = Promise.resolve();

      // Regard the child nodes in one combo as a graph, and layout them from bottom to top
      graphTreeDfs(
        graph,
        [root],
        (treeNode) => {
          if (!treeNode.data._isCombo) return;
          const { size: nsize, padding } = getSize(treeNode);
          if (!graph.getChildren(treeNode.id, treeKey)?.length) {
            // empty combo
            comboNodes.set(treeNode.id, {
              id: treeNode.id,
              data: {
                ...treeNode.data,
                size: nsize,
              },
            });
          } else {
            // combo not empty
            const comboNode = comboNodes.get(treeNode.id);
            comboNodes.set(treeNode.id, {
              id: treeNode.id,
              data: {
                nodes: [],
                ...comboNode?.data,
              },
            });
            const innerLayoutNodeIds = new Map();
            const innerLayoutNodes = graph
              .getChildren(treeNode.id, treeKey)
              .map((child) => {
                if (child.data._isCombo) {
                  if (!comboNodes.has(child.id)) {
                    comboNodes.set(child.id, {
                      id: child.id,
                      data: {
                        ...child.data,
                      },
                    });
                  }
                  innerLayoutNodeIds.set(child.id, true);
                  return comboNodes.get(child.id);
                }
                const oriNode = nodeMap.get(child.id) || comboMap.get(child.id);
                innerLayoutNodeIds.set(child.id, true);
                return {
                  id: child.id,
                  data: {
                    ...oriNode.data,
                    ...child.data,
                  },
                };
              });
            const innerGraphData = {
              nodes: innerLayoutNodes,
              edges: edges.filter(
                (edge) =>
                  innerLayoutNodeIds.has(edge.source) &&
                  innerLayoutNodeIds.has(edge.target),
              ),
            };
            let minNodeSize = Infinity;
            innerLayoutNodes.forEach((node) => {
              let { size } = node.data;
              if (!size) {
                size = comboNodes.get(node.id)?.data.size ||
                  (nodeSize as Function)?.(node) || [30, 30];
              }
              if (isNumber(size)) size = [size, size];
              const [size0, size1] = size;
              if (minNodeSize > size0) minNodeSize = size0;
              if (minNodeSize > size1) minNodeSize = size1;
              node.data.size = size;
            });

            // innerGraphLayout.assign(innerGraphCore, innerLayoutOptions);
            start = start.then(async () => {
              const innerGraphCore = new GraphCore(innerGraphData);
              await executeLayout(
                innerGraphLayout,
                innerGraphCore,
                innerLayoutOptions,
                true,
              );
              const { minX, minY, maxX, maxY } = getLayoutBBox(
                innerLayoutNodes as OutNode[],
              );
              // move the innerGraph to [0, 0], for later controlled by parent layout
              const center = { x: (maxX + minX) / 2, y: (maxY + minY) / 2 };
              innerGraphData.nodes.forEach((node) => {
                node.data.x -= center.x;
                node.data.y -= center.y;
              });
              const size: [number, number] = [
                Math.max(maxX - minX, minNodeSize) + padding * 2,
                Math.max(maxY - minY, minNodeSize) + padding * 2,
              ];

              comboNodes.get(treeNode.id).data.size = size;
              comboNodes.get(treeNode.id).data.nodes = innerLayoutNodes;
            });
          }
          return true;
        },
        'BT',
        treeKey,
      );
      innerLayoutPromises.push(start);
    });
    return innerLayoutPromises;
  }
}

async function executeLayout(
  layout: Layout<any>,
  graph: Graph,
  options: Record<string, any>,
  assign?: boolean,
) {
  if (isLayoutWithIterations(layout)) {
    layout.execute(graph, options);
    layout.stop();
    return layout.tick(options.iterations ?? 300);
  }
  if (assign) return await layout.assign(graph, options);
  return await layout.execute(graph, options);
}
