// "use strict";

// const _ = require("./lodash");
// const acyclic = require("./acyclic");
// const normalize = require("./normalize");
// const rank = require("./rank");
// const normalizeRanks = require("./util").normalizeRanks;
// const parentDummyChains = require("./parent-dummy-chains");
// const removeEmptyRanks = require("./util").removeEmptyRanks;
// const nestingGraph = require("./nesting-graph");
// const addBorderSegments = require("./add-border-segments");
// const coordinateSystem = require("./coordinate-system");
// const order = require("./order");
// const position = require("./position");
// const util = require("./util");
// const Graph = require("./graphlib").Graph;
// const initDataOrder = require("./order/init-data-order");

import acyclic from './acyclic';
import normalize from './normalize';
import rank from './rank';
import util, { normalizeRanks, removeEmptyRanks } from './util';
import parentDummyChains from './parent-dummy-chains';
import nestingGraph from './nesting-graph';
import addBorderSegments from './add-border-segments';
import coordinateSystem from './coordinate-system';
import order from './order';
import position from './position';
import graphlib from './graphlib';
import initDataOrder from './order/init-data-order';
import { Graph as IGraph } from '../types';

const Graph = (graphlib as any).Graph;

const layout = (g: IGraph, opts: any) => {
  const time = opts && opts.debugTiming ? util.time : util.notime;
  time("layout", () => {
    // 如果在原图基础上修改，继承原图的order结果
    if (opts && !opts.keepNodeOrder && opts.prevGraph) {
      time("  inheritOrder", () => { inheritOrder(g, opts.prevGraph); });
    }
    const layoutGraph: any = 
      time("  buildLayoutGraph", () => { return buildLayoutGraph(g); });
    // 控制是否为边的label留位置（这会影响是否在边中间添加dummy node）
    if (!(opts && (opts.edgeLabelSpace === false))) {
      time("  makeSpaceForEdgeLabels", () => { makeSpaceForEdgeLabels(layoutGraph); });
    }
    // TODO: 暂时处理层级设置不正确时的异常报错，提示设置正确的层级
    try {
      time("  runLayout",        () => { runLayout(layoutGraph, time, opts); });
    } catch(e) {
      if (e.message === "Not possible to find intersection inside of the rectangle") {
        console.error('The following error may be caused by improper layer setting, please make sure your manual layer setting does not violate the graph\'s structure:\n', e);
        return;
      } else {
        throw(e);
      }
    }
    time("  updateInputGraph", () => { updateInputGraph(g, layoutGraph); });
  });
}

const runLayout = (g: IGraph, time: any, opts: any) => {
  time("    removeSelfEdges",        () => { removeSelfEdges(g); });
  time("    acyclic",                () => { acyclic.run(g); });
  time("    nestingGraph.run",       () => { nestingGraph.run(g); });
  time("    rank",                   () => { rank(util.asNonCompoundGraph(g) as any); });
  time("    injectEdgeLabelProxies", () => { injectEdgeLabelProxies(g); });
  time("    removeEmptyRanks",       () => { removeEmptyRanks(g); });
  time("    nestingGraph.cleanup",   () => { nestingGraph.cleanup(g); });
  time("    normalizeRanks",         () => { normalizeRanks(g); });
  time("    assignRankMinMax",       () => { assignRankMinMax(g); });
  time("    removeEdgeLabelProxies", () => { removeEdgeLabelProxies(g); });
  time("    normalize.run",          () => { normalize.run(g); });
  time("    parentDummyChains",      () => { parentDummyChains(g); });
  time("    addBorderSegments",      () => { addBorderSegments(g); });
  if (opts && opts.keepNodeOrder) {
    time("    initDataOrder", () => { initDataOrder(g, opts.nodeOrder); });
  }
  time("    order",                  () => { order(g); });
  time("    insertSelfEdges",        () => { insertSelfEdges(g); });
  time("    adjustCoordinateSystem", () => { coordinateSystem.adjust(g); });
  time("    position",               () => { position(g); });
  time("    positionSelfEdges",      () => { positionSelfEdges(g); });
  time("    removeBorderNodes",      () => { removeBorderNodes(g); });
  time("    normalize.undo",         () => { normalize.undo(g); });
  time("    fixupEdgeLabelCoords",   () => { fixupEdgeLabelCoords(g); });
  time("    undoCoordinateSystem",   () => { coordinateSystem.undo(g); });
  time("    translateGraph",         () => { translateGraph(g); });
  time("    assignNodeIntersects",   () => { assignNodeIntersects(g); });
  time("    reversePoints",          () => { reversePointsForReversedEdges(g); });
  time("    acyclic.undo",           () => { acyclic.undo(g); });
}

/**
 * 继承上一个布局中的order，防止翻转
 * TODO: 暂时没有考虑涉及层级变动的布局，只保证原来布局层级和相对顺序不变
 */
const inheritOrder = (currG: IGraph, prevG: IGraph) => {
  const prevNodeMap: any = prevG._nodes || {};
  currG.nodes().forEach((n: string) => {
    const node = currG.node(n);
    if (prevNodeMap[n] !== undefined) {
      node.fixorder = prevNodeMap[n]._order;
      delete prevNodeMap[n]._order;
    } else {
      delete node.fixorder;
    }
  });
}

/*
 * Copies final layout information from the layout graph back to the input
 * graph. This process only copies whitelisted attributes from the layout graph
 * to the input graph, so it serves as a good place to determine what
 * attributes can influence layout.
 */
const updateInputGraph = (inputGraph: IGraph, layoutGraph: IGraph) => {
  inputGraph.nodes().forEach((v) => {
    const inputLabel = inputGraph.node(v);
    const layoutLabel = layoutGraph.node(v);

    if (inputLabel) {
      inputLabel.x = layoutLabel.x;
      inputLabel.y = layoutLabel.y;
      inputLabel._order = layoutLabel.order;
      inputLabel._rank = layoutLabel.rank;

      if (layoutGraph.children(v)?.length) {
        inputLabel.width = layoutLabel.width;
        inputLabel.height = layoutLabel.height;
      }
    }
  });

  inputGraph.edges().forEach((e) => {
    const inputLabel = inputGraph.edge(e);
    const layoutLabel = layoutGraph.edge(e);

    inputLabel.points = layoutLabel.points;
    if (layoutLabel.hasOwnProperty("x")) {
      inputLabel.x = layoutLabel.x;
      inputLabel.y = layoutLabel.y;
    }
  });

  inputGraph.graph().width = layoutGraph.graph().width;
  inputGraph.graph().height = layoutGraph.graph().height;
}

const graphNumAttrs = ["nodesep", "edgesep", "ranksep", "marginx", "marginy"];
const graphDefaults = { ranksep: 50, edgesep: 20, nodesep: 50, rankdir: "tb" };
const graphAttrs = ["acyclicer", "ranker", "rankdir", "align"];
const nodeNumAttrs = ["width", "height", "layer", "fixorder"]; // 需要传入layer, fixOrder作为参数参考
const nodeDefaults = { width: 0, height: 0 };
const edgeNumAttrs = ["minlen", "weight", "width", "height", "labeloffset"];
const edgeDefaults = {
  minlen: 1, weight: 1, width: 0, height: 0,
  labeloffset: 10, labelpos: "r"
};
const edgeAttrs = ["labelpos"];

/*
 * Constructs a new graph from the input graph, which can be used for layout.
 * This process copies only whitelisted attributes from the input graph to the
 * layout graph. Thus this function serves as a good place to determine what
 * attributes can influence layout.
 */
const buildLayoutGraph = (inputGraph: IGraph) => {
  const g = new Graph({ multigraph: true, compound: true });
  const graph = canonicalize(inputGraph.graph());

  const pickedProperties: any = {};
  graphAttrs.forEach(key => {
    pickedProperties[key] = graph[key];
  });

  g.setGraph(Object.assign({},
    graphDefaults,
    selectNumberAttrs(graph, graphNumAttrs),
    pickedProperties));

  inputGraph.nodes().forEach((v) => {
    const node = canonicalize(inputGraph.node(v));
    const defaultAttrs = selectNumberAttrs(node, nodeNumAttrs);
    Object.keys(nodeDefaults).forEach(key => {
      if (defaultAttrs[key] === undefined) {
        defaultAttrs[key] = (nodeDefaults as any)[key];
      }
    })
    g.setNode(v, defaultAttrs);
    g.setParent(v, inputGraph.parent(v));
  });

  inputGraph.edges().forEach((e) => {
    const edge = canonicalize(inputGraph.edge(e));
    
    const pickedProperties: any = {};
    edgeAttrs.forEach(key => {
      pickedProperties[key] = edge[key];
    });

    g.setEdge(e, Object.assign({},
      edgeDefaults,
      selectNumberAttrs(edge, edgeNumAttrs),
      pickedProperties));
  });

  return g;
}

/*
 * This idea comes from the Gansner paper: to account for edge labels in our
 * layout we split each rank in half by doubling minlen and halving ranksep.
 * Then we can place labels at these mid-points between nodes.
 *
 * We also add some minimal padding to the width to push the label for the edge
 * away from the edge itself a bit.
 */
const makeSpaceForEdgeLabels = (g: IGraph) => {
  const graph = g.graph();
  if (!graph.ranksep) graph.ranksep = 0;
  graph.ranksep /= 2;
  g.nodes().forEach((n) => {
    const node = g.node(n);
    if (!isNaN(node.layer as any)) {
      if (!node.layer) node.layer = 0;
      else node.layer *= 2; // TODO: 因为默认的rank变为两倍，设定的layer也*2
    }
  });
  g.edges().forEach((e) => {
    const edge = g.edge(e);
    edge.minlen *= 2;
    if (edge.labelpos.toLowerCase() !== "c") {
      if (graph.rankdir === "TB" || graph.rankdir === "BT") {
        edge.width += edge.labeloffset;
      } else {
        edge.height += edge.labeloffset;
      }
    }
  });
}

/*
 * Creates temporary dummy nodes that capture the rank in which each edge's
 * label is going to, if it has one of non-zero width and height. We do this
 * so that we can safely remove empty ranks while preserving balance for the
 * label's position.
 */
const injectEdgeLabelProxies = (g: IGraph) => {
  g.edges().forEach((e) => {
    const edge = g.edge(e);
    if (edge.width && edge.height) {
      const v = g.node(e.v);
      const w = g.node(e.w);
      const label = { rank: ((w.rank as number) - (v.rank as number)) / 2 + (v.rank as number), e: e };
      util.addDummyNode(g, "edge-proxy", label, "_ep");
    }
  });
}

const assignRankMinMax = (g: IGraph) => {
  let maxRank = 0;
  g.nodes().forEach((v) => {
    const node = g.node(v);
    if (node.borderTop) {
      node.minRank = g.node(node.borderTop).rank;
      node.maxRank = g.node(node.borderBottom).rank;
      maxRank = Math.max(maxRank, node.maxRank || -Infinity);
    }
  });
  g.graph().maxRank = maxRank;
}

const removeEdgeLabelProxies = (g: IGraph) => {
  g.nodes().forEach((v) => {
    const node = g.node(v);
    if (node.dummy === "edge-proxy") {
      g.edge((node as any).e).labelRank = node.rank;
      g.removeNode(v);
    }
  });
}

const translateGraph = (g: IGraph) => {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = 0;
  const graphLabel = g.graph();
  const marginX = graphLabel.marginx || 0;
  const marginY = graphLabel.marginy || 0;

  const getExtremes = (attrs: any) => {
    const x = attrs.x;
    const y = attrs.y;
    const w = attrs.width;
    const h = attrs.height;
    minX = Math.min(minX, x - w / 2);
    maxX = Math.max(maxX, x + w / 2);
    minY = Math.min(minY, y - h / 2);
    maxY = Math.max(maxY, y + h / 2);
  }

  g.nodes().forEach((v) => { getExtremes(g.node(v)); });
  g.edges().forEach((e) => {
    const edge = g.edge(e);
    if (edge.hasOwnProperty("x")) {
      getExtremes(edge);
    }
  });

  minX -= marginX;
  minY -= marginY;

  g.nodes().forEach((v) => {
    const node = g.node(v);
    node.x -= minX;
    node.y -= minY;
  });

  g.edges().forEach((e) => {
    const edge = g.edge(e);
    edge.points.forEach((p) => {
      p.x -= minX;
      p.y -= minY;
    });
    if (edge.hasOwnProperty("x")) { edge.x -= minX; }
    if (edge.hasOwnProperty("y")) { edge.y -= minY; }
  });

  graphLabel.width = maxX - minX + marginX;
  graphLabel.height = maxY - minY + marginY;
}

const assignNodeIntersects = (g: IGraph) => {
  g.edges().forEach((e) => {
    const edge = g.edge(e);
    const nodeV = g.node(e.v);
    const nodeW = g.node(e.w);
    let p1, p2;
    if (!edge.points) {
      edge.points = [];
      p1 = nodeW;
      p2 = nodeV;
    } else {
      p1 = edge.points[0];
      p2 = edge.points[edge.points.length - 1];
    }
    edge.points.unshift(util.intersectRect(nodeV, p1));
    edge.points.push(util.intersectRect(nodeW, p2));
  });
}

const fixupEdgeLabelCoords = (g: IGraph) => {
  g.edges().forEach((e) => {
    const edge = g.edge(e);
    if (edge.hasOwnProperty("x")) {
      if (edge.labelpos === "l" || edge.labelpos === "r") {
        edge.width -= edge.labeloffset;
      }
      switch (edge.labelpos) {
      case "l": edge.x -= edge.width / 2 + edge.labeloffset; break;
      case "r": edge.x += edge.width / 2 + edge.labeloffset; break;
      }
    }
  });
}

const reversePointsForReversedEdges = (g: IGraph) => {
  g.edges().forEach((e) => {
    const edge = g.edge(e);
    if (edge.reversed) {
      edge.points.reverse();
    }
  });
}

const removeBorderNodes = (g: IGraph) => {
  g.nodes().forEach((v) => {
    if (g.children(v)?.length) {
      const node = g.node(v);
      const t = g.node(node.borderTop);
      const b = g.node(node.borderBottom);
      const l = g.node(node.borderLeft[node.borderLeft?.length - 1]);
      const r = g.node(node.borderRight[node.borderRight?.length - 1]);

      node.width = Math.abs(r.x - l.x);
      node.height = Math.abs(b.y - t.y);
      node.x = l.x + node.width / 2;
      node.y = t.y + node.height / 2;
    }
  });

  g.nodes().forEach((v) => {
    if (g.node(v).dummy === "border") {
      g.removeNode(v);
    }
  });
}

const removeSelfEdges = (g: IGraph) => {
  g.edges().forEach((e) => {
    if (e.v === e.w) {
      const node = g.node(e.v);
      if (!node.selfEdges) {
        node.selfEdges = [];
      }
      node.selfEdges.push({ e, label: g.edge(e) });
      g.removeEdge(e);
    }
  });
}

const insertSelfEdges = (g: IGraph) => {
  const layers = util.buildLayerMatrix(g);
  layers.forEach((layer: string[]) => {
    let orderShift = 0;
    layer.forEach((v: string, i: number) => {
      const node = g.node(v);
      node.order = i + orderShift;
      node.selfEdges?.forEach((selfEdge: any) => {
        util.addDummyNode(g, "selfedge", {
          width: selfEdge.label.width,
          height: selfEdge.label.height,
          rank: node.rank,
          order: i + (++orderShift),
          e: selfEdge.e,
          label: selfEdge.label
        }, "_se");
      });
      delete node.selfEdges;
    });
  });
}

const positionSelfEdges = (g: IGraph) => {
  g.nodes().forEach((v) => {
    const node = g.node(v);
    if (node.dummy === "selfedge") {
      const selfNode = g.node((node as any).e.v);
      const x = selfNode.x + selfNode.width / 2;
      const y = selfNode.y;
      const dx = node.x - x;
      const dy = selfNode.height / 2;
      g.setEdge((node as any).e, node.label);
      g.removeNode(v);
      node.label.points = [
        { x: x + 2 * dx / 3, y: y - dy },
        { x: x + 5 * dx / 6, y: y - dy },
        { x: x +     dx    , y: y },
        { x: x + 5 * dx / 6, y: y + dy },
        { x: x + 2 * dx / 3, y: y + dy }
      ];
      node.label.x = node.x;
      node.label.y = node.y;
    }
  });
}

const selectNumberAttrs = (obj: any, attrs: any) => {
  const pickedProperties: any = {};
  attrs.forEach((key: string) => {
    pickedProperties[key] = (+obj[key]);
  })
  return pickedProperties;
}

const canonicalize = (attrs: any) => {
  const newAttrs: any = {};
  attrs.forEach((v: any, k: string) => {
    newAttrs[k.toLowerCase()] = v;
  });
  return newAttrs;
}

export default layout;
