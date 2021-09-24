import * as d3Force from 'd3-force';
import forceGrid from './forceGrid';
import mysqlWorkbench from './mysqlWorkbench';
import { DagreLayout } from '../dagre';
import { INode, IEdge, } from "./type";

export default function layout(data: any, options: any): Promise<void> {
  
  const { nodes, edges } = data;
  const width = options.width;
  const height = options.height;
  if (!nodes?.length) return Promise.resolve();

  // 筛选非叶子节点，做Dagre布局
  const noLeafNodes : INode[] = [];
  nodes.forEach((node: any) => {
    const relateEdges = edges.filter((edge: IEdge) => {
      return edge.source === node.id || edge.target === node.id;
    });
    if (relateEdges.length > 1) {
      const node_c = { ...node };
      delete node_c.size;
      noLeafNodes.push(node_c);
    }
  });
  const noLeafEdge: IEdge[] = [];
  edges.forEach((edge: IEdge) => {
    const sourceNode = noLeafNodes.find((node: INode) => node.id === edge.source );
    const targetNode = noLeafNodes.find((node: INode) => node.id === edge.target );
    if (sourceNode && targetNode) {
      noLeafEdge.push(edge);
    }
  });
  const graphLayout = new DagreLayout({
    type: 'dagre',
    ranksep: options.nodeMinGap,
    nodesep: options.nodeMinGap,
  });
  
  const { nodes: nodesTmp } = graphLayout.layout({
    nodes: noLeafNodes,
    edges: noLeafEdge,
  });

  // 布局后，坐标同步
  nodes.forEach((n: INode) => {
    const found = (nodesTmp || []).find((temp: any) => temp.id === n.id);
    n.x = found?.x || width / 2;
    n.y = found?.y || height / 2;
  });
  
  const copyNodes = JSON.parse(JSON.stringify(nodes));
  const copyEdges = JSON.parse(JSON.stringify(edges));
  const simulation = d3Force.forceSimulation().nodes(copyNodes)
  .force("link", d3Force.forceLink(copyEdges).id(d => d.id).distance((d) => {
    const edgeInfo = noLeafEdge.find((edge) => edge.source === d.source && edge.target === d.target);
    if (edgeInfo) {
      return 30;
    }
    return 20;
  }))
  .force("charge", d3Force.forceManyBody())
  .force("center", d3Force.forceCenter(width / 2, height / 2))
  .force("x", d3Force.forceX(width / 2))
  .force("y", d3Force.forceY( height / 2))
  .alpha(0.3)
  .alphaDecay(0.08)
  .alphaMin(0.001);

  const layoutPromise = new Promise<void>((resolve) => {
    simulation.on('end', () => {
      // 坐标信息同步到nodes,edges中
      nodes.forEach((node) => {
        const nodeInfo = copyNodes.find((item) => item.id === node.id);
        if (nodeInfo) {
          node.x = nodeInfo.x;
          node.y = nodeInfo.y;
        }
      })
      
      let minX = Math.min(...nodes.map((node: INode) => node.x));
      let maxX = Math.max(...nodes.map((node: INode) => node.x));
      let minY = Math.min(...nodes.map((node: INode) => node.y));
      let maxY = Math.max(...nodes.map((node: INode) => node.y));
      const scalex = width / (maxX - minX);
      const scaley = height / (maxY - minY);
      nodes.forEach((node: INode) => {
        if (node.x !== undefined && scalex < 1) {
          node.x = (node.x - minX) * scalex;
        }
        if (node.y !== undefined && scaley < 1) {
          node.y = (node.y - minY) * scaley;
        }
      });

      // 这一步就执行缩小空间。且不考虑节点size
      nodes.forEach((node: INode) => {
        node.size_tmp = node.size;
        node.size = [10, 10];
      });
     
      mysqlWorkbench(nodes, edges);
      nodes.forEach((node: INode) => {
        node.size = node.size_tmp || [];
        delete node.size_tmp;
      });
      // 进行网格对齐+节点大小扩增
      forceGrid({
        nodes,
        edges,
      }, options);

      resolve();
    });
  });
  return layoutPromise;
}
