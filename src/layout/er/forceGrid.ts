import Grid from './grid';
import { INode, IEdgeInfo } from './type';

export default function layout(data: {
  nodes: INode[],
  edges: IEdgeInfo[],
}, options: any) {
  if (!data.nodes || data.nodes.length === 0) return data;
  const width = options.width;
  const height = options.height;
  const nodeMinGap = options.nodeMinGap;

  // 2. 网格布局
  let CELL_W = 10000;
  let CELL_H = 10000;
  data.nodes.forEach((node) => {
    const nodeWidth = node.size[0] || 50;
    const nodeHeight = node.size[1] || 50;

    CELL_W = Math.min(nodeWidth, CELL_W);
    CELL_H = Math.min(nodeHeight, CELL_H);
  });

  const grid = new Grid();
  grid.init(width, height, {
    CELL_H,
    CELL_W,
  });

  data.nodes.forEach((d) => {
    let gridpoint = grid.occupyNearest(d);
    if (gridpoint) {         
        gridpoint.node = {
          id: d.id,
          size: d.size,
        };
        d.x = gridpoint.x;
        d.y = gridpoint.y;
        d.dx = gridpoint.dx;
        d.dy = gridpoint.dy;
      }
  });

  // 加入节点size
  for (var i = 0; i < data.nodes.length; i++) {
    //  节点宽度大于网格宽度，则往当前网格的右边插入列
    const node = data.nodes[i];
    const result = grid.findGridByNodeId(node.id);
    if (!result) throw new Error("can not find node cell");
    
    const { column, row } = result;
    if ((node.size[0] + nodeMinGap) > CELL_W) {
      let addGridSize = Math.ceil((node.size[0] +nodeMinGap) / CELL_W) - 1;
      let realAdd = addGridSize;
      // 优化，假设同一列，不同行存在两个size为2的节点，遍历到第一个节点的时候，会往右插入两列，遍历到第二个节点，又往右插入。就会导致多余的网格
      for(var j=0; j< addGridSize; j++) {
        const hasColumn = grid.additionColumn.indexOf(column + j + 1) > -1;
        if (hasColumn && !grid.cells[column + j + 1][row].node) {
          realAdd --;
        } else {
          break;
        }
      }
      grid.insertColumn(column, realAdd);
    }
    // 节点高度大于网格宽度，则往当前网格的下边插入行
    if ((node.size[1] +nodeMinGap) > CELL_H) {
      let addGridSize = Math.ceil((node.size[1]+nodeMinGap) / CELL_H) - 1;
      let realAdd = addGridSize;
      for(var j=0; j< addGridSize; j++) {
        const hasColumn = grid.additionRow.indexOf(row + j + 1) > -1;
        if (hasColumn && !grid.cells[column][row + j + 1].node) {
          realAdd --;
        } else {
          break;
        }
      }
      grid.insertRow(row, realAdd);
    }
  }
 
  // 同步节点坐标
  for(var i = 0; i < grid.columnNum; i++) {
    for(var j = 0; j < grid.rowNum; j++) {
      const cell = grid.cells[i][j];
      if (cell.node) {
        const node = data.nodes.find(node => node.id === cell?.node?.id);
        if (node) {
          node.x = cell.x + node.size[0] / 2;
          node.y = cell.y + node.size[1] / 2;
        }
      }
    }
  }
}