import { FruchtermanLayout, Graph } from "../packages/layout";
import { FruchtermanLayout as FruchtermanGPULayout } from "../packages/layout-gpu";
import { fruchtermanReingoldLayout } from "./graphology-layout-fruchtermanreingold";
import {
  distanceThresholdMode,
  outputAntvLayout,
  outputAntvLayoutWASM,
  outputGraphology,
} from "./util";
import { CANVAS_SIZE } from "./types";
import type { Layouts } from "../packages/layout-wasm";
import { CommonLayoutOptions } from "./main";

const speed = 5;
const gravity = 1;
const ITERATIONS = 5000;
const SPEED_DIVISOR = 800;

export async function graphology(
  graph: any,
  { iterations }: CommonLayoutOptions
) {
  const positions = fruchtermanReingoldLayout(graph, {
    height: CANVAS_SIZE,
    width: CANVAS_SIZE,
    iterations: iterations || ITERATIONS,
    speed,
    gravity,
    C: 1,
    edgeWeightInfluence: 0,
  });

  return outputGraphology(graph, positions, (node) => {
    node.x = node.x + CANVAS_SIZE / 2;
    node.y = node.y + CANVAS_SIZE / 2;
  });
}

export async function antvlayout(
  graphModel: Graph,
  { iterations, min_movement, distance_threshold_mode }: CommonLayoutOptions
) {
  const fruchterman = new FruchtermanLayout({
    height: CANVAS_SIZE,
    width: CANVAS_SIZE,
    center: [CANVAS_SIZE / 2, CANVAS_SIZE / 2],
    gravity,
    speed,
    maxIteration: iterations || ITERATIONS,
  });
  const positions = await fruchterman.execute(graphModel);
  return outputAntvLayout(positions);
}

export async function antvlayoutGPU(
  graphModel: Graph,
  { iterations, min_movement, distance_threshold_mode }: CommonLayoutOptions
) {
  const fruchterman = new FruchtermanGPULayout({
    height: CANVAS_SIZE,
    width: CANVAS_SIZE,
    center: [CANVAS_SIZE / 2, CANVAS_SIZE / 2],
    gravity,
    speed,
    maxIteration: iterations || ITERATIONS,
  });
  const positions = await fruchterman.execute(graphModel);
  return outputAntvLayout(positions);
}

export async function antvlayoutWASM(
  { nodes, edges, masses, weights }: any,
  { iterations, min_movement, distance_threshold_mode }: CommonLayoutOptions,
  { fruchterman }: Layouts
) {
  const { nodes: positions } = await fruchterman({
    nodes,
    edges,
    masses,
    weights,
    iterations: iterations || ITERATIONS,
    min_movement,
    distance_threshold_mode: distanceThresholdMode(distance_threshold_mode),
    height: CANVAS_SIZE,
    width: CANVAS_SIZE,
    center: [CANVAS_SIZE / 2, CANVAS_SIZE / 2],
    kg: gravity, // gravity
    speed, // speed
  });

  return outputAntvLayoutWASM(positions, edges);
}