import { Graph as AntvGraph } from '@antv/graphlib';
import Graph from 'graphology';
import { clusters } from 'graphology-generators/random';
import { CANVAS_SIZE, TestName } from './types';

export const loadDatasets = async (dimensions = 2) => {
  const datasets: Record<any, any> = {};

  const loadRandomClusters = (NODES: number, EDGES: number) => {
    // Use graphology generator.
    const graph = clusters(Graph, {
      order: NODES,
      size: EDGES,
      clusters: 5,
    });
    graph.edges().forEach(function (edge, i) {
      // graph.setEdgeAttribute(edge, "weight", i > EDGES / 2 ? 1 : 100);
      graph.setEdgeAttribute(edge, 'weight', 1);
    });
    graph.nodes().forEach(function (node) {
      graph.setNodeAttribute(node, 'x', Math.random() * CANVAS_SIZE);
      graph.setNodeAttribute(node, 'y', Math.random() * CANVAS_SIZE);
      graph.setNodeAttribute(node, 'width', 10);
      graph.setNodeAttribute(node, 'height', 10);

      if (dimensions === 3) {
        graph.setNodeAttribute(node, 'z', Math.random() * CANVAS_SIZE);
      }
    });

    const antvgraph = graphology2antv(graph);

    return {
      desc: 'Creates a graph with the desired number of nodes & edges and having a given number of clusters. Generated by Graphology Generators.',
      [TestName.GRAPHOLOGY]: graph,
      [TestName.ANTV_LAYOUT]: antvgraph,
      [TestName.ANTV_LAYOUT_GPU]: antvgraph,
      [TestName.ANTV_LAYOUT_WASM_SINGLETHREAD]: antvgraph,
      [TestName.ANTV_LAYOUT_WASM_MULTITHREADS]: antvgraph,
    };
  };

  const loadG6JSON = (url: string, desc: string) => {
    return async () => {
      const result = await fetch(url);
      const oldG6GraphFormat = await result.json();

      // format old G6 graph format to @antv/graphlib
      // assign random positions
      const nodes: any[] = [];
      const edges: any[] = [];
      const uniqueNodes = new Set();
      oldG6GraphFormat.nodes.forEach((node: any, i: number) => {
        // remove duplicated nodes
        if (!uniqueNodes.has(node.id)) {
          uniqueNodes.add(node.id);

          // clear
          node.x = undefined;
          node.y = undefined;
          node.z = undefined;

          nodes.push({
            id: node.id,
            data: { x: node.x, y: node.y, z: node.z },
          });
        }
      });
      oldG6GraphFormat.edges.forEach((edge: any, i: number) => {
        if (edge.id === undefined) {
          edge.id = `e${i}`;
        }
        if (edge.weight === undefined || edge.weight === null) {
          edge.weight = 1;
        } else {
          edge.weight = Number(edge.weight);
        }

        edges.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: { weight: edge.weight },
        });
      });

      const antvGraphModel = new AntvGraph({
        nodes,
        edges,
      });

      const graphlibModel = antv2graphology(antvGraphModel);
      return {
        desc,
        [TestName.GRAPHOLOGY]: graphlibModel,
        [TestName.ANTV_LAYOUT]: antvGraphModel,
        [TestName.ANTV_LAYOUT_GPU]: antvGraphModel,
        [TestName.ANTV_LAYOUT_WASM_SINGLETHREAD]: antvGraphModel,
        [TestName.ANTV_LAYOUT_WASM_MULTITHREADS]: antvGraphModel,
      };
    };
  };

  const [
    randomClusters100,
    randomClusters1000,
    randomClusters2_1000,
    randomClusters2000,
    relations,
    netscience,
    eva,
    regions,
  ] = await Promise.all([
    loadRandomClusters(100, 100),
    loadRandomClusters(1000, 1000),
    loadRandomClusters(2000, 1000),
    loadRandomClusters(2000, 2000),
    loadG6JSON(
      'https://gw.alipayobjects.com/os/antvdemo/assets/data/relations.json',
      'A small dataset of "relations" between people.',
    )(),
    loadG6JSON(
      'https://gw.alipayobjects.com/os/basement_prod/da5a1b47-37d6-44d7-8d10-f3e046dabf82.json',
      'Netscience with 1589 nodes & 2742 edges.',
    )(),
    loadG6JSON(
      'https://gw.alipayobjects.com/os/basement_prod/0b9730ff-0850-46ff-84d0-1d4afecd43e6.json',
      'Eva with 8322 nodes & 5421 edges.',
    )(),
    loadG6JSON(
      'https://gw.alipayobjects.com/os/basement_prod/7bacd7d1-4119-4ac1-8be3-4c4b9bcbc25f.json',
      'A dataset for regions on earth.',
    )(),
  ]);

  datasets['random-clusters-100'] = randomClusters100;
  datasets['random-clusters-1000'] = randomClusters1000;
  datasets['random-clusters2-1000'] = randomClusters2_1000;
  datasets['random-clusters-2000'] = randomClusters2000;
  datasets.relations = relations;
  datasets.netscience = netscience;
  datasets.eva = eva;
  datasets.regions = regions;

  return datasets;
};

const graphology2antv = (graph: any): AntvGraph<any, any> => {
  return new AntvGraph({
    nodes: graph.nodes().map((id: any) => ({
      id,
      data: {
        x: graph.getNodeAttribute(id, 'x'),
        y: graph.getNodeAttribute(id, 'y'),
        z: graph.getNodeAttribute(id, 'z'),
      },
    })),
    edges: graph.edges().map((id: any) => ({
      id,
      source: graph.source(id),
      target: graph.target(id),
      data: {
        weight: graph.getEdgeAttribute(id, 'weight'),
      },
    })),
  });
};

const antv2graphology = (graph: AntvGraph<any, any>) => {
  const g = new Graph();
  graph.getAllNodes().forEach(({ id, data: { x, y, z } }: any) => {
    if (!g.hasNode(id)) {
      g.addNode(id, { x, y, z });
    }
  });
  graph.getAllEdges().forEach(({ source, target, data: { weight } }: any) => {
    g.addEdge(source, target, { weight });
  });
  return g;
};
