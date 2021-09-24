import { ICell } from './type';

export default class Grid {
  public cells: ICell[][] = [];
  public columnNum:number = 0;
  public rowNum: number = 0;
  
  public additionColumn: number[] = [];
  public additionRow: number[] = [];
  private static MIN_DIST = 50;
  private static DEFAULT_CELL_W = 80;
  private static DEFAULT_CELL_H = 80;
  private CELL_W: number;
  private CELL_H: number;

  public init(width: number, height: number, gridSize: {
    CELL_W: number,
    CELL_H: number,
  }) {
    this.cells = [];
    this.CELL_W = gridSize.CELL_W || Grid.DEFAULT_CELL_W;
    this.CELL_H = gridSize.CELL_H || Grid.DEFAULT_CELL_H;
    this.columnNum = Math.ceil(width / this.CELL_W);
    this.rowNum = Math.ceil(height / this.CELL_H);
    Grid.MIN_DIST = Math.pow(width, 2) + Math.pow(height, 2);

    for(var i = 0; i < this.columnNum; i++) {
      const tmp = [];
      for(var j = 0; j < this.rowNum; j++) {
        var cell = {
          dx: i,
          dy: j,
          x : i * this.CELL_W,
          y : j * this.CELL_H,
          occupied : false
        };
        tmp.push(cell);
      };
      this.cells.push(tmp);
    };
  }

  public findGridByNodeId(nodeId: string){
    for(var i = 0; i < this.columnNum; i++) {
      for(var j = 0; j < this.rowNum; j++) {
        if(this.cells[i][j].node) {
          if (this.cells[i][j]?.node?.id === nodeId) {
            return {column: i, row: j};
          }
        }
      }
    }
    return null;
  }
    
  public sqdist(a: any, b: any) {
    return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
  }

  public occupyNearest(p) {
    var minDist = Grid.MIN_DIST;
    var d;
    var candidate = null;
    for(var i = 0; i < this.columnNum; i++) {
      for(var j = 0; j < this.rowNum; j++) {
        if(!this.cells[i][j].occupied && ( d = this.sqdist(p, this.cells[i][j])) < minDist) {
          minDist = d;
          candidate = this.cells[i][j];
        }
      };
    };
    if(candidate)
      candidate.occupied = true;
    return candidate;
  }

  public insertColumn(columnIndex: number, length: number) {
    if (length <= 0) return ;
    // 插入空列
    for (var i = 0; i < length; i++) {
      this.cells[i + this.columnNum] = [];
      for(var j = 0; j < this.rowNum; j++) {
        this.cells[i + this.columnNum][j] = {
          dx: i,
          dy: j,
          x : i * this.CELL_W,
          y : j * this.CELL_H,
          occupied : false,
          node: null,
        };
      }
    }
    // 交换数据
    for(var i = (this.columnNum - 1); i > columnIndex; i--) {
      for (var j = 0; j < this.rowNum; j++) {
        this.cells[i + length][j] = {
          ...this.cells[i][j],
          x: (i+length) * this.CELL_W,
          y: j * this.CELL_H,
        };;
        this.cells[i][j] = {
          x : i * this.CELL_W,
          y : j * this.CELL_H,
          occupied : true,
          node: null,
        };
      }
    }
    // 已有行列的处理
    for (var j = 0; j < this.additionColumn.length; j++) {
      if (this.additionColumn[j] >= columnIndex) {
        this.additionColumn[j] += length;
      }
    }
    // 记录新增的行列
    for (var i = 0; i < length; i++) {
      this.additionColumn.push(columnIndex + i + 1);
    }
    this.columnNum += length;
  }

  public insertRow(rowIndex: number, length: number) {
    if (length <= 0) return ;
    // 插入空行
    for (var j = 0; j < length; j++) {
      for(var i = 0; i < this.columnNum; i++) {
        this.cells[i][j + this.rowNum] = {
          dx: i,
          dy: j,
          x : i * this.CELL_W,
          y : j * this.CELL_H,
          occupied : false,
          node: null,
        };
      }
    }

    // 交换数据
    for(var i = 0; i < this.columnNum; i++) {
      for (var j = (this.rowNum - 1); j > rowIndex; j--) {
        this.cells[i][j+length] = {
          ...this.cells[i][j],
          dx: i,
          dy: j + length,
          x: i * this.CELL_W,
          y: (j+length) * this.CELL_H,
        };
        this.cells[i][j] = {
          dx: i,
          dy: j,
          x : i * this.CELL_W,
          y : j *this.CELL_H,
          occupied : false,
          node: null,
        };
        
      }
    }
    
    // 已有行列的处理
    for (var j = 0; j < this.additionRow.length; j++) {
      if (this.additionRow[j] >= rowIndex) {
        this.additionRow[j] += length;
      }
    }
    // 记录新增的行列
    for (var i = 0; i < length; i++) {
      this.additionRow.push(rowIndex + i + 1);
    }
    this.rowNum += length;
  }

  public getNodes() {
    const nodes = [];
    for(var i = 0; i < this.columnNum; i++) {
      for(var j = 0; j < this.rowNum; j++) {
        if(this.cells[i][j].node) {
          nodes.push(this.cells[i][j])
        }
      }
    }
    return nodes;
  }
}