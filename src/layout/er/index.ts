/**
 * @fileOverview Force Layout Grid Align layout
 * @author wenyanqi
 */

import { Base } from "../base";
import layout from './core';

export interface ERLayoutOptions {
  type: "er";
  width?: number;
  height?: number;
  nodeMinGap?: number;
}

export class ERLayout extends Base {

  public width: number = 300;
  public height: number = 300;
  public nodeMinGap: number = 50;

  /** 迭代结束的回调函数 */
  public onLayoutEnd: () => void = () => { };

  constructor(options?: any) {
    super();
    if (options) {
      this.updateCfg(options);
    }
  }

  public getDefaultCfg() {
    return {
      width: 300,
      height: 300,
      nodeMinGap: 50,
    };
  }

  /**
   * 执行布局
   */
  public execute() {
    const self = this;
    const nodes = self.nodes;
    const edges = self.edges;
    // 节点初始化，size初始化
    nodes?.forEach((node) => {
      if (!node.size) {
        node.size = [50, 50];
      }
    });
    return layout({
      nodes, edges,
    }, {
      width: this.width,
      height: this.height,
      nodeMinGap: this.nodeMinGap,
    }).then(() => {
      if (self.onLayoutEnd) self.onLayoutEnd();
    });
  }

  public getType() {
    return "er";
  }
}
