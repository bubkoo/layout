import type { ID } from '@antv/graphlib';
import { deepMix, pick } from '@antv/util';
import type { Simulation } from 'd3-force';
import {
  forceCenter,
  forceCollide,
  ForceLink,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import type { Graph, LayoutMapping, LayoutWithIterations } from '../types';
import type { D3ForceLayoutOptions, EdgeDatum, NodeDatum } from './types';

export class D3ForceLayout<
  T extends D3ForceLayoutOptions = D3ForceLayoutOptions,
> implements LayoutWithIterations<T>
{
  public id = 'd3-force';

  public simulation: Simulation<NodeDatum, EdgeDatum>;

  protected resolver: (value: LayoutMapping) => void;

  protected config = {
    inputNodeAttrs: ['x', 'y', 'vx', 'vy', 'fx', 'fy'],
    outputNodeAttrs: ['x', 'y', 'vx', 'vy'],
    simulationAttrs: [
      'alpha',
      'alphaMin',
      'alphaDecay',
      'alphaTarget',
      'velocityDecay',
      'randomSource',
    ],
  };

  protected forceMap: Record<string, Function> = {
    link: forceLink,
    manyBody: forceManyBody,
    center: forceCenter,
    collide: forceCollide,
    radial: forceRadial,
    x: forceX,
    y: forceY,
  };

  // @ts-ignore
  public options: Partial<T> = {
    link: {
      id: (edge) => edge.id,
    },
    manyBody: {},
    center: {
      x: 0,
      y: 0,
    },
  };

  protected context: {
    assign: boolean;
    options: Partial<T>;
    nodes: NodeDatum[];
    edges: EdgeDatum[];
    graph?: Graph;
  } = {
    options: {},
    assign: false,
    nodes: [],
    edges: [],
  };

  constructor(options?: Partial<T>) {
    deepMix(this.options, options);
    if (this.options.forceSimulation) {
      this.simulation = this.options.forceSimulation;
    }
  }

  public async execute(graph: Graph, options?: T): Promise<LayoutMapping> {
    return this.genericLayout(false, graph, options);
  }

  public async assign(graph: Graph, options?: T): Promise<void> {
    await this.genericLayout(true, graph, options);
  }

  public stop() {
    this.simulation.stop();
  }

  public tick(iterations?: number): LayoutMapping {
    this.simulation.tick(iterations);
    return this.getResult();
  }

  public restart() {
    this.simulation.restart();
  }

  public setFixedPosition(id: ID, position: (number | null)[]) {
    const node = this.context.nodes.find((n) => n.id === id);
    if (!node) return;
    position.forEach((value, index) => {
      if (typeof value === 'number' || value === null) {
        const key = ['fx', 'fy', 'fz'][index];
        node[key] = value;
      }
    });
  }

  protected getOptions(options: Partial<T>): T {
    const _ = deepMix({}, this.options, options) as T;
    // process nodeSize
    if (_.collide && _.collide?.radius === undefined) {
      _.collide = _.collide || {};
      // @ts-ignore
      _.collide.radius = _.nodeSize ?? 10;
    }
    // process iterations
    if (_.iterations === undefined) {
      if (_.link && _.link.iterations === undefined) {
        _.iterations = _.link.iterations;
      }
      if (_.collide && _.collide.iterations === undefined) {
        _.iterations = _.collide.iterations;
      }
    }

    // assign to context
    this.context.options = _;
    return _ as T;
  }

  protected async genericLayout(
    assign: boolean,
    graph: Graph,
    options?: T,
  ): Promise<LayoutMapping> {
    const _options = this.getOptions(options);

    const nodes = graph.getAllNodes().map(({ id, data }) => ({
      id,
      ...data,
      ...pick(data.data, this.config.inputNodeAttrs),
    }));

    const edges = graph.getAllEdges().map((edge) => ({ ...edge }));

    Object.assign(this.context, { assign, nodes, edges, graph });

    const promise = new Promise<LayoutMapping>((resolver) => {
      this.resolver = resolver;
    });

    const simulation = this.setSimulation(_options);

    simulation.nodes(nodes);
    simulation.force<ForceLink<NodeDatum, EdgeDatum>>('link')?.links(edges);

    return promise;
  }

  protected getResult(): LayoutMapping {
    const { assign, nodes, edges, graph } = this.context;

    const nodesResult = nodes.map((node) => ({
      id: node.id,
      data: {
        ...node.data,
        ...(pick<any>(node, this.config.outputNodeAttrs) as any),
      },
    }));

    const edgeResult = edges.map(({ id, source, target, data }) => ({
      id,
      source: typeof source === 'object' ? source.id : source,
      target: typeof target === 'object' ? target.id : target,
      data,
    }));

    if (assign) {
      nodesResult.forEach((node) => graph.mergeNodeData(node.id, node.data));
    }

    return { nodes: nodesResult, edges: edgeResult };
  }

  protected initSimulation() {
    return forceSimulation<NodeDatum, EdgeDatum>();
  }

  protected setSimulation(options: T) {
    const simulation =
      this.simulation || this.options.forceSimulation || this.initSimulation();

    if (!this.simulation) {
      this.simulation = simulation
        .on('tick', () => options.onTick?.(this.getResult()))
        .on('end', () => this.resolver?.(this.getResult()));
    }

    apply(
      simulation,
      this.config.simulationAttrs.map((name) => [
        name,
        options[name as keyof T],
      ]),
    );

    Object.entries(this.forceMap).forEach(([name, Ctor]) => {
      const forceName = name;
      if (options[name as keyof T]) {
        let force = simulation.force(forceName);
        if (!force) {
          force = Ctor();
          simulation.force(forceName, force);
        }
        apply(force, Object.entries(options[forceName as keyof T]));
      } else simulation.force(forceName, null);
    });

    return simulation;
  }
}

const apply = (target: any, params: [string, any][]) => {
  return params.reduce((acc, [method, param]) => {
    if (!acc[method] || param === undefined) return acc;
    return acc[method].call(target, param);
  }, target);
};
