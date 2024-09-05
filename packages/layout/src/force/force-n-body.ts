import { quadtree } from 'd3-quadtree';
// @ts-ignore
import { octree } from 'd3-octree';
import { Point } from '../types';
import { CalcGraph } from './types';

const theta2 = 0.81; // Barnes-Hut approximation threshold
const epsilon = 0.1; // 为了防止出现除0的情况，加一个epsilon

interface InternalNode {
  id: string;
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  weight: number;
  size: number;
}

export function forceNBody(
  calcGraph: CalcGraph,
  factor: number,
  coulombDisScale2: number,
  accMap: { [id: string]: Point },
  dimensions: number = 2,
) {
  const weightParam = factor / coulombDisScale2;
  const calcNodes = calcGraph.getAllNodes();
  const data = calcNodes.map((calcNode, i) => {
    const { nodeStrength, x, y, z, size } = calcNode.data;
    return {
      x,
      y,
      z,
      size,
      index: i,
      id: calcNode.id,
      vx: 0,
      vy: 0,
      vz: 0,
      weight: weightParam * nodeStrength,
    };
  });

  const tree = (
    dimensions === 2
      ? quadtree(
          data,
          (d: any) => d.x,
          (d: any) => d.y,
        )
      : octree(
          data,
          (d: any) => d.x,
          (d: any) => d.y,
          (d: any) => d.z,
        )
  ).visitAfter(accumulate); // init internal node

  const nodeMap = new Map();
  data.forEach((n) => {
    nodeMap.set(n.id, n);
    // @ts-ignore
    computeForce(n, tree, dimensions);
  });

  data.map((n, i) => {
    const { id, data } = calcNodes[i];
    const { mass = 1 } = data;
    // 从 0 开始，= 初始化 + 加斥力
    accMap[id] = {
      x: n.vx / mass,
      y: n.vy / mass,
      z: n.vz / mass,
    };
  });
  return accMap;
}

function accumulate(treeNode: any) {
  let accWeight = 0;
  let accX = 0;
  let accY = 0;
  let accZ = 0;
  let accSize = 0;
  const numChildren = treeNode.length;

  if (numChildren) {
    // internal node, accumulate 4 child quads
    for (let i = 0; i < numChildren; i++) {
      const q = treeNode[i];
      if (q && q.weight) {
        accWeight += q.weight;
        accX += q.x * q.weight;
        accY += q.y * q.weight;
        accZ += q.z * q.weight;
        accSize += q.size * q.weight;
      }
    }
    treeNode.x = accX / accWeight;
    treeNode.y = accY / accWeight;
    treeNode.z = accZ / accWeight;
    treeNode.size = accSize / accWeight;
    treeNode.weight = accWeight;
  } else {
    // leaf node
    const q = treeNode;
    treeNode.x = q.data.x;
    treeNode.y = q.data.y;
    treeNode.z = q.data.z;
    treeNode.size = q.data.size;
    treeNode.weight = q.data.weight;
  }
}

const apply = (
  treeNode: any,
  x1: number,
  arg1: number,
  arg2: number,
  arg3: number,
  node: InternalNode,
  dimensions: number,
) => {
  if (treeNode.data?.id === node.id) return;
  const x2 = [arg1, arg2, arg3][dimensions - 1];

  const dx = node.x - treeNode.x || epsilon;
  const dy = node.y - treeNode.y || epsilon;
  const dz = node.z - treeNode.z || epsilon;
  const pos = [dx, dy, dz];
  const width = x2 - x1;
  let len2 = 0;
  for (let i = 0; i < dimensions; i++) {
    len2 += pos[i] * pos[i];
  }
  const len1 = Math.sqrt(len2);
  const len3 = len1 * len2;

  // far node, apply Barnes-Hut approximation
  if (width * width * theta2 < len2) {
    const param = treeNode.weight / len3;
    node.vx += dx * param;
    node.vy += dy * param;
    node.vz += dz * param;
    return true;
  }
  // near quad, compute force directly
  if (treeNode.length) return false; // internal node, visit children

  // leaf node

  if (treeNode.data !== node) {
    const param = treeNode.data.weight / len3;
    node.vx += dx * param;
    node.vy += dy * param;
    node.vz += dz * param;
  }
};

// @ts-ignore
function computeForce(node: InternalNode, tree: any, dimensions: number) {
  // @ts-ignore
  tree.visit((treeNode, x1, y1, x2, y2) =>
    apply(treeNode, x1, y1, x2, y2, node, dimensions),
  );
}
