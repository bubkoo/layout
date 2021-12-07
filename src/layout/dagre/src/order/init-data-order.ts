// "use strict";

import { Graph } from "../../types";

// const _ = require("../lodash");



/**
 * 按照数据中的结果设置fixorder
 */
const initDataOrder = (g: Graph, nodeOrder: string[]) => {
  const simpleNodes = g.nodes().filter((v) => {
    return !g.children(v)?.length;
  });
  const ranks = simpleNodes.map((v) => (g.node(v).rank as number));
  const maxRank = Math.max(...ranks);
  const layers: any = [];
  for (let i = 0; i < maxRank + 1; i ++) {
    layers.push([]);
  }
  // const layers = _.map(_.range(maxRank + 1), function() { return []; });
  nodeOrder.forEach((n) => {
    const node = g.node(n);
    // 只考虑原有节点，dummy节点需要按照后续算法排出
    if (!node || node.dummy) return;
    node.fixorder = layers[(node.rank as number)].length; // 设置fixorder为当层的顺序
    layers[node.rank as number].push(n);
  });
}

export default initDataOrder;