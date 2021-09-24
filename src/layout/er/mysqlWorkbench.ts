const graphWidth = 1200;
const graphHeight = 800;
const OVERLAP_QUOT = 10000000;
const MIN_DIST = 10;
const M_PI = 3.14159265358979323846;
const M_PI_2 = 1.57079632679489661923;
const PI_38 = M_PI * 0.375;
const PI_58 = M_PI * 0.625;
const nodeEdgeMap = new Map();
let CELL_W = 10;
let CELL_H = 10;
let T = 0.8;
const T_MIN = 0.1;
const R = 0.5;

function distanceToNode(node1, node2, isHoriz) {

  const x11 = node1.x - node1.size[0] / 2;
  const y11 = node1.y - node1.size[1] / 2;
  const x12 = node1.x + node1.size[0] / 2;
  const y12 = node1.y + node1.size[1] / 2;

  const x21 = node2.x - node2.size[0] / 2;
  const y21 = node2.y - node2.size[1] / 2;
  const x22 = node2.x + node2.size[0] / 2;
  const y22 = node2.y + node2.size[1] / 2;

  const cx1 = node1.x;
  const cy1 = node1.y;
  const cx2 = node2.x;
  const cy2 = node2.y;
  const dcx = cx2 - cx1;
  // 两个节点间的方位角  
  const qr = Math.atan2(dcx, (cy2 - cy1));
  let dx = 0;
  let dy = 0;
  let l1 = 0;
  let l2 = 0;
  if (qr > M_PI_2) {
    dy = y11 - y22;
    dx = x21 - x12;
    l1 = parseFloat(dy ? (dy / Math.cos(qr)).toFixed(2) : (dx).toFixed(2)); 
    l2 = parseFloat(dx ? (dx / Math.sin(qr)).toFixed(2) : (dy).toFixed(2)); 
  } else if (0.0 < qr && qr <= M_PI_2) {
    dy = y21 - y12;
    dx = x21 - x12;
    if (dy > dx) {
      l1 = l2 = parseFloat(dy ? (dy / Math.cos(qr)).toFixed(2) : (dx).toFixed(2));
    } else {
      l1 = l2 = parseFloat(dx ? (dx / Math.sin(qr)).toFixed(2) : (dy).toFixed(2));
    }
      
  } else if (qr < -M_PI_2) {
    dy = y11 - y22;
    dx = -(x22 - x11);
    if (dy > dx) {
      l1 = l2 = parseFloat(dy ? (dy / Math.cos(qr)).toFixed(2) : (dx).toFixed(2));
    } else {
      l1 = l2 = parseFloat(dx ? (dx / Math.sin(qr)).toFixed(2) : (dy).toFixed(2));
    }
  }else {
    dy = y21 - y12;
    if (Math.abs(dcx) > (x12 - x11) / 2) {
      dx = x11 - x22;
    } else {
      dx = dcx;
    }
      
    if (dy > dx) {
      l1 = l2 = parseFloat(dy ? (dy / Math.cos(qr)).toFixed(2) : (dx).toFixed(2));
    } else {
      l1 = l2 = parseFloat((dx && qr != 0.0) ? (dx / Math.sin(qr)).toFixed(2) : (dy).toFixed(2));
    }
      
  }
  const aqr = parseFloat(qr.toFixed(2));
  // 判断是否水平，角度
  if (isHoriz) {
    isHoriz = PI_38 < aqr && aqr < PI_58;
  }
  return Math.abs(l1 < l2 ? l1 : l2);
}

function calcNodePair(nodeA, nodeB) {
  // 确定两个节点间是否存在连线
  const edges = nodeEdgeMap.get(nodeA.id) || [];
  const isLinked = edges.find((edge) => {
    return edge.source === nodeB.id || edge.target === nodeB.id;
  });

  const areaA = nodeA.size[0] * nodeA.size[1];
  const areaB = nodeB.size[0] * nodeB.size[1];
  let node1 = areaA > areaB ? nodeB : nodeA;
  let node2 = areaA > areaB ? nodeA : nodeB;

  const x11 = node1.x - node1.size[0] / 2;
  const y11 = node1.y - node1.size[1] / 2;
  const x12 = node1.x + node1.size[0] / 2;
  const y12 = node1.y + node1.size[1] / 2;

  const x21 = node2.x - node2.size[0] / 2;
  const y21 = node2.y - node2.size[1] / 2;
  const x22 = node2.x + node2.size[0] / 2;
  const y22 = node2.y + node2.size[1] / 2;

  const cx1 = node1.x;
  const cy1 = node1.y;
  const cx2 = node2.x;
  const cy2 = node2.y;

  // Detect if nodes overlap  检查节点之间是否存在覆盖问题
  const isOverlap = ((x12 >= x21) && (x22 >= x11) && (y12 >= y21) && (y22 >= y11));
  let e = 0;
  let distance = 0;
  
  if (isOverlap) {
    
    distance = Math.sqrt(Math.pow((cx2 - cx1), 2) + Math.pow((cy2 - cy1), 2));

    // calc area of overlap 计算重复区域的坐标和面积
    const sx1 = x11 > x21 ? x11 : x21;
    const sy1 = y11 > y21 ? y11 : y21;
    const sx2 = x12 < x22 ? x12 : x22;
    const sy2 = y12 < y22 ? y12 : y22;
    const dsx = sx2 - sx1;
    const dsy = sy2 - sy1;

    const Sov = dsx * dsy;

    if (distance == 0.0) {
      distance = 0.0000001;
    }

    e = MIN_DIST * 1 / distance * 100 + Sov;
    e *= OVERLAP_QUOT;
  } else {
    let isHoriz = false;
    distance = distanceToNode(node1, node2, isHoriz);

    if (distance <= MIN_DIST) {
      if (distance != 0) {
        if (isLinked) {
          e += MIN_DIST + OVERLAP_QUOT * 1 / distance;
        }
        else {
          e += MIN_DIST + OVERLAP_QUOT * MIN_DIST / distance;
        }  
      } else {
        e += OVERLAP_QUOT;
      }
    } else {
      e += distance;
      if (isLinked) {
        e += distance * distance;
      } 
    }
  }

  return e;
}
function calcEnergy(nodes: any) {
  let energy = 0;
  for(let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if ((node.x < 0) || (node.y < 0) || (node.x > graphWidth) || (node.y > graphHeight)) {
      energy += 1000000000000;
    }
    for (let j = i + 1; j < nodes.length; j++) {
      energy += calcNodePair(node, nodes[j]);
    }
  }

  return energy;
}

function isCorrectPosition(node, newPosition, nodes, edges, ) {
  const relateEdges = edges.filter((edge) => edge.source.id === node.id || edge.target.id === node.id) || [];
  const relateNodes = [];
  relateEdges.forEach((edge) => {
    const otherNode = edge.source.id === node.id ? edge.target : edge.source;
    if (otherNode) {
      relateNodes.push(otherNode);
    }
  });
  let flag = true;
  for(let i = 0; i < relateNodes.length; i++) {
    const item = relateNodes[i];
    // 判断条件调整，节点的坐标不需要完全一致。可以根据节点间的夹角来判断
    const delta = Math.atan((node.y - item.y) / (item.x - node.y)) * 180;
    const newDelta = Math.atan((newPosition.y - item.y) / (item.x - newPosition.y)) * 180;
    const isHor = delta < 30 || delta > 150;
    let newIsHor = newDelta < 30 || newDelta > 150;
    const isVer = delta > 70 && delta < 110;
    const newIsVer = newDelta > 70 && newDelta < 110;
    // 定义四个相似角度区间，0-15度，75-90度，90到105度，165到180度。
    if (isHor && !newIsHor || ((delta * newDelta) < 0)) {
      flag = false;
      break;
    } else if (isVer && !newIsVer || ((delta * newDelta) < 0)) {
      flag = false;
      break;
    } else if ((item.x - node.x) * (item.x - newPosition.x) < 0) {
      flag = false;
      break;
    }else if ((item.y - node.y) * (item.y - newPosition.y) < 0) {
      flag = false;
      break;
    }
  }
  return flag;

}

function shuffle(nodes, edges) {
  let foundSmallerEnergy = false;
  // 多次测试发现step为1时的效果最佳。
  const step = 1;
  for (let i = 0; i < nodes.length; ++i) {
    const node = nodes[i];
    const wstep = CELL_W * step;
    const hstep = CELL_H * step;
    let nodeEnergy = calcNodeEnergy(node, nodes);

    const wsteps = [ wstep, -wstep, 0, 0, ];
    const hsteps = [ 0, 0, hstep, -hstep, ];
    for (let ns = 0; ns < wsteps.length ; ns++) {
      // 判断新位置与其他连线节点的位置关系是否违规
      const flag = isCorrectPosition(node, { x: node.x + wsteps[ns], y: node.y + hsteps[ns] }, nodes, edges);
      if (flag) {
        // 节点朝上下左右四个方向移动，找到能量最小的那个位置
        node.x += wsteps[ns];
        node.y += hsteps[ns];
        
        // 计算移动后节点的能量
        const energy = calcNodeEnergy(node, nodes);
        const rdm = Math.random();
        
        if (energy < nodeEnergy) {
          nodeEnergy = energy;
          foundSmallerEnergy = true;
         
        } else if (rdm < T && rdm > T_MIN) {
          nodeEnergy = energy;
          foundSmallerEnergy = true;
         
        } else {
          // 回归原位
          node.x -= wsteps[ns];
          node.y -= hsteps[ns];
        }
      }   
    }

  }
  if (T > T_MIN) {
    T *= R;
  }
   // 重新计算图整体的能量
  if (foundSmallerEnergy) {
    return calcEnergy(nodes);
  }
  return 0;
}

// 计算节点的能量，
function calcNodeEnergy(node, nodes) {
  let e = 0.0;

  if ((node.x < 0) || (node.x < 0) || (node.x + node.size[0] +20 > graphWidth) || (node.y2 + node.size[1] +  20 > graphHeight)) {
    e += 1000000000000.0;
  }

  for (let i = 0; i < nodes.length; ++i) {
    if (node.id != nodes[i].id) {
      e += calcNodePair(node, nodes[i]);
    }
  }
  return e;
}

function layout(nodes: any, edges: any) {
  if (nodes.length === 0) {
    return { nodes, edges };
  }
  nodes.forEach((node: any) => {
    const relateEdge = edges.filter((edge) => edge.source === node.id || edge.target === node.id);
    nodeEdgeMap.set(node, relateEdge);
  });

  // 1. 初始化
  // 将node按照连接数进行排序
  nodes = nodes.sort((node1, node2) => {
    return nodeEdgeMap.get(node1.id)?.length - nodeEdgeMap.get(node2.id)?.length;
  });

  // 2. 计算图能量
  let minEnergy = calcEnergy(nodes);
  let deSameCount = 20; // de=0 count
  let de = 1;      // energy delta
  let prevEnergy = 0;
  // 定义总的迭代次数。超过就停掉，防止死循环
  const MAX_COUNT = 50;
  let count = 0;
  while (deSameCount > 0) {
    count ++;
    if (count >= MAX_COUNT) {
      break;
    }
    const ea = shuffle(nodes, edges);
    if (ea !== 0) {
      prevEnergy = ea;
    } 
    de = prevEnergy - minEnergy;
    minEnergy = prevEnergy;
    if (de === 0) {
      --deSameCount;
    } else {
      deSameCount = 20;
    }
  }
  nodes.forEach((node) => {
    node.x = node.x - node.size[0] / 2;
    node.y = node.y - node.size[1] / 2;
  })
 
  return {
    nodes,
    edges,
  };
}

export default layout;