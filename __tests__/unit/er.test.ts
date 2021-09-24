import { ERLayout } from '../../src/layout/er';
import { OutNode } from '../../src/layout/types';

const data = {
  nodes: [{
    id: 'node1',
    size: [150, 300],
    label: 'node1',
  }, {
    id: 'node2',
    size: [150, 300],
    label: 'node2',
  }, {
    id: 'node3',
    size: [150, 300],
    label: 'node3',
  }, {
    id: 'node4',
    size: [150, 300],
    label: 'node4',
  }, {
    id: 'node5',
    size: [150, 200],
    label: 'node5',
  }, {
    id: 'node6',
    size: [150, 100],
    label: 'node6',
  }],
  edges: [
    {
      source: 'node1',
      target: 'node2',
    },
    {
      source: 'node1',
      target: 'node3',
    },
    {
      source: 'node1',
      target: 'node4',
    },
    {
      source: 'node1',
      target: 'node5',
    },
    {
      source: 'node1',
      target: 'node6',
    },
  ]
};
const erNode1 = {
  nodes: [{
    id: 'relTable1',
    size: [280, 500],
    label: 'relTable1',
  }, {
    id: 'virTable1',
    size: [280, 100],
    label: 'virTable1',
  }, {
    id: 'virTable2',
    size: [280, 100],
    label: 'virTable2',
  }, {
    id: 'virTable3',
    size: [280, 100],
    label: 'virTable3',
  }, {
    id: 'virTable4',
    size: [280, 100],
    label: 'virTable4',
  }, {
    id: 'virTable5',
    size: [280, 100],
    label: 'virTable5',
  }, {
    id: 'virTable6',
    size: [280, 100],
    label: 'virTable6',
  }, {
    id: 'relTable2',
    size: [280, 300],
    label: 'relTable2',
  }, {
    id: 'virTable7',
    size: [280, 100],
    label: 'virTable7',
  }, {
    id: 'virTable8',
    size: [280, 100],
    label: 'virTable8',
  }, {
    id: 'virTable9',
    size: [280, 100],
    label: 'virTable9',
  }],
  edges: [{
    source: 'relTable1',
    target: 'virTable1',
  }, {
    source: 'relTable1',
    target: 'virTable2',
  }, {
    source: 'relTable1',
    target: 'virTable3',
  }, {
    source: 'relTable1',
    target: 'virTable4',
  }, {
    source: 'relTable1',
    target: 'virTable5',
  }, {
    source: 'relTable1',
    target: 'virTable6',
  }, {
    source: 'relTable2',
    target: 'virTable6',
  }, {
    source: 'relTable2',
    target: 'virTable7',
  }, {
    source: 'relTable2',
    target: 'virTable8',
  }]
};
const complexDataUrl = 'https://gw.alipayobjects.com/os/antvdemo/assets/data/relations.json';

describe('#ERLayout', () => {
  it('return correct default config', async () => {
    const er = new ERLayout();
    expect(er.getDefaultCfg()).toEqual({
      width: 300,
      height: 300,
      nodeMinGap: 50,
    });
    await er.layout(data);
    expect((data.nodes[0] as any).x).not.toBe(undefined);
    expect((data.nodes[0] as any).y).not.toBe(undefined);
  });
  it('er layout without node', () => {
    const dataNoNode = {nodes: [], edges: []};
    const er = new ERLayout();
    er.layout(dataNoNode);
    expect(dataNoNode.nodes).not.toBe(undefined);
  });
  it('er layout without node size is null', () => {
    const dataOneNode = {nodes: [{id: 'node'}], edges: []};
    const er = new ERLayout();
    er.layout(dataOneNode);
    expect((dataOneNode.nodes[0] as OutNode).x).not.toBe(undefined);
    expect((dataOneNode.nodes[0] as OutNode).y).not.toBe(undefined);
  });
  it('er layout with simple data config', async () => {
    const er = new ERLayout({
      width: 1200,
      height: 800,
    });
    await er.layout(data);
  });
  it('er layout with isolate node ', async () => {
    const er = new ERLayout({
      width: 1200,
      height: 800,
      nodeMinGap: 30,
    });
    await er.layout(erNode1);
  });
  it('er layout with complex node ', async () => {
    const er = new ERLayout({
      width: 1200,
      height: 800,
      nodeMinGap: 30,
    });
    fetch(complexDataUrl)
    .then((res) => res.json())
    .then(async (data) => {
      await er.layout(data);
    });
  });

});