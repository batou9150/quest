import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Graph, layout } from '@dagrejs/dagre';
import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, ChevronLeft, Maximize2, Minimize2, Network, RotateCcw, X } from 'lucide-react';
import { levelGraph, type GraphEdge, type GraphEdgeKind, type GraphNode, type GraphNodeKind, type Level } from '@quest/engine';
import { useApi } from '../../lib/hooks';
import { PageHeader } from '../../components/PageHeader';
import { ErrorMessage, Loading } from '../../components/Status';
import { btnGhost, btnSmall, card, chip, chipActive, chipIdle } from '../../components/ui';

// --- Colours and legend ------------------------------------------------------

const NODE_STYLE: Record<GraphNodeKind, { color: string; name: string; width: number; height: number }> = {
  room: { color: '#22d3ee', name: 'Room', width: 190, height: 58 },
  finish: { color: '#34d399', name: 'Level exit', width: 150, height: 46 },
  item: { color: '#fbbf24', name: 'Item', width: 160, height: 46 },
  flag: { color: '#a78bfa', name: 'Flag (world state)', width: 140, height: 36 },
  action: { color: '#fb7185', name: 'Action (use rule)', width: 220, height: 60 },
};

interface EdgeStyle {
  color: string;
  name: string;
  dashed?: boolean;
  group: EdgeGroup;
}

type EdgeGroup = 'map' | 'items' | 'actions' | 'conditions';

const EDGE_STYLE: Record<GraphEdgeKind, EdgeStyle> = {
  exit: { color: '#22d3ee', name: 'Exit between rooms', group: 'map' },
  contains: { color: '#fbbf24', name: 'Item lies in room', group: 'items' },
  uses: { color: '#fb7185', name: 'Item used by action', group: 'actions' },
  sets: { color: '#a78bfa', name: 'Action sets flag', group: 'actions' },
  clears: { color: '#e879f9', name: 'Action clears flag', group: 'actions', dashed: true },
  gives: { color: '#34d399', name: 'Action gives item', group: 'actions' },
  spawns: { color: '#2dd4bf', name: 'Action drops item in room', group: 'actions' },
  removes: { color: '#f87171', name: 'Action uses up item', group: 'actions', dashed: true },
  requires: { color: '#fb923c', name: 'Needed for exit or action', group: 'conditions' },
  forbids: { color: '#facc15', name: 'Only while flag NOT set', group: 'conditions', dashed: true },
};

const GROUPS: Array<{ id: EdgeGroup; name: string; toggle: boolean }> = [
  { id: 'map', name: 'Map', toggle: false },
  { id: 'items', name: 'Items in rooms', toggle: true },
  { id: 'actions', name: 'Actions & effects', toggle: true },
  { id: 'conditions', name: 'Conditions', toggle: true },
];

// --- Layout ------------------------------------------------------------------

type QuestNode = Node<{ graph: GraphNode; selected: boolean }, 'quest'>;

const isPlace = (n: GraphNode) => n.kind === 'room' || n.kind === 'finish';

/** Spacing of the room map, and of each room's group of items, actions and flags. */
const MAP = { nodesep: 60, ranksep: 110 };
const GROUP = { nodesep: 14, ranksep: 46, gap: 36, indent: 20 };

/**
 * Picks the room each item, action and flag is drawn under: where an item lies at the start,
 * the room an action is limited to (or where its fixed object, else the item it uses, lies), where a flag is set.
 * Items created by an action follow that action. Anything left goes under the start room.
 */
function anchorRooms(nodes: GraphNode[], edges: GraphEdge[]): Map<string, string> {
  const anchor = new Map<string, string>();
  for (const n of nodes) if (n.kind === 'room') anchor.set(n.id, n.id);
  for (const n of nodes) if (n.kind === 'action' && n.room) anchor.set(n.id, n.room);
  for (const e of edges) if (e.kind === 'contains') anchor.set(e.target, e.source);
  // An action happens where its fixed object is (you carry the other item there): use the reactor, not the fuse.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const item = byId.get(e.source);
    if (e.kind === 'uses' && item?.detail === 'fixed' && anchor.has(e.source) && !anchor.has(e.target)) {
      anchor.set(e.target, anchor.get(e.source)!);
    }
  }
  // Propagate along action links until nothing changes (chains: item → action → flag → ...).
  const follows: GraphEdgeKind[] = ['uses', 'sets', 'clears', 'gives', 'spawns'];
  for (let changed = true; changed; ) {
    changed = false;
    for (const e of edges) {
      if (!follows.includes(e.kind) || anchor.has(e.target) || !anchor.has(e.source)) continue;
      anchor.set(e.target, anchor.get(e.source)!);
      changed = true;
    }
  }
  const start = nodes.find((n) => n.start)?.id;
  for (const n of nodes) if (!anchor.has(n.id) && !isPlace(n) && start) anchor.set(n.id, start);
  return anchor;
}

/** Lays out a room's group left to right; returns positions relative to the group's top-left corner. */
function layoutGroup(members: GraphNode[], edges: GraphEdge[]) {
  const ids = new Set(members.map((n) => n.id));
  const g = new Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: GROUP.nodesep, ranksep: GROUP.ranksep });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of members) g.setNode(n.id, { width: NODE_STYLE[n.kind].width, height: NODE_STYLE[n.kind].height });
  for (const e of edges) if (ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target, {}, e.id);
  layout(g);
  const positions = new Map<string, XYPosition>();
  let width = 0;
  let height = 0;
  for (const n of members) {
    const { x, y } = g.node(n.id);
    const { width: w, height: h } = NODE_STYLE[n.kind];
    positions.set(n.id, { x: x - w / 2, y: y - h / 2 });
    width = Math.max(width, x + w / 2);
    height = Math.max(height, y + h / 2);
  }
  return { positions, width, height };
}

/**
 * Two-level layout: the rooms form a left-to-right map from entrance to exit, and under each room
 * sits its own group of items, actions and flags. Each room is laid out as a box big enough for its group.
 */
function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string | null,
): { nodes: QuestNode[]; edges: Edge[]; entrance: Array<{ id: string }> } {
  const anchor = anchorRooms(nodes, edges);
  const groups = new Map<string, ReturnType<typeof layoutGroup>>();
  for (const room of nodes.filter((n) => n.kind === 'room')) {
    const members = nodes.filter((n) => !isPlace(n) && anchor.get(n.id) === room.id);
    if (members.length) groups.set(room.id, layoutGroup(members, edges));
  }

  const map = new Graph();
  map.setGraph({ rankdir: 'LR', nodesep: MAP.nodesep, ranksep: MAP.ranksep, marginx: 20, marginy: 20 });
  map.setDefaultEdgeLabel(() => ({}));
  const box = (n: GraphNode) => {
    const { width, height } = NODE_STYLE[n.kind];
    const group = groups.get(n.id);
    return group
      ? { width: Math.max(width, GROUP.indent + group.width), height: height + GROUP.gap + group.height }
      : { width, height };
  };
  for (const n of nodes.filter(isPlace)) map.setNode(n.id, box(n));
  // Only forward exits shape the map; exits back toward the start would create loops.
  for (const e of edges) if (e.kind === 'exit' && !e.backward) map.setEdge(e.source, e.target);
  layout(map);

  const positions = new Map<string, XYPosition>();
  for (const n of nodes.filter(isPlace)) {
    const { x, y } = map.node(n.id);
    const { width, height } = box(n);
    const topLeft = { x: x - width / 2, y: y - height / 2 };
    positions.set(n.id, topLeft);
    const group = groups.get(n.id);
    for (const [id, p] of group?.positions ?? []) {
      positions.set(id, {
        x: topLeft.x + GROUP.indent + p.x,
        y: topLeft.y + NODE_STYLE[n.kind].height + GROUP.gap + p.y,
      });
    }
  }

  const left = Math.min(...[...positions.values()].map((p) => p.x));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    entrance: nodes.filter((n) => positions.get(n.id)!.x - left < 1100).map((n) => ({ id: n.id })),
    nodes: nodes.map((n) => {
      const { width, height } = NODE_STYLE[n.kind];
      return {
        id: n.id,
        type: 'quest',
        position: positions.get(n.id)!,
        data: { graph: n, selected: n.id === selectedId },
        width,
        height,
        // Sizes are fixed per kind: giving them up front lets React Flow drag nodes without measuring them.
        measured: { width, height },
      };
    }),
    edges: edges.map((e) => {
      const style = EDGE_STYLE[e.kind];
      const touchesSelection = selectedId !== null && (e.source === selectedId || e.target === selectedId);
      const faded = selectedId !== null && !touchesSelection;
      const label = e.kind === 'exit' && e.locked ? `${e.label} 🔒` : e.label;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        ...handlesFor(e, byId.get(e.target)!),
        type: e.kind === 'contains' ? 'smoothstep' : 'default',
        label,
        animated: e.kind === 'exit' && touchesSelection,
        style: {
          stroke: style.color,
          strokeWidth: e.kind === 'exit' ? 2.5 : 1.5,
          strokeDasharray: style.dashed || (e.kind === 'exit' && e.locked) ? '6 4' : undefined,
          // Exits back toward the entrance are drawn lighter: the main path reads left to right.
          opacity: faded ? 0.15 : e.backward && !touchesSelection ? 0.45 : 1,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color, width: 16, height: 16 },
        labelStyle: { fill: style.color, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', opacity: faded ? 0.2 : 1 },
        labelBgStyle: { fill: '#020617', fillOpacity: faded ? 0.2 : 0.85 },
        labelBgPadding: [4, 2] as [number, number],
      };
    }),
  };
}

/**
 * Which side of each node a link uses (see the handles in QuestNodeView):
 * forward exits right → left in the upper half, exits back left → right in the lower half (two lanes),
 * a room's items hang from its bottom, conditions on an exit arrive at the bottom of the room it opens.
 */
function handlesFor(e: GraphEdge, target: GraphNode): { sourceHandle: string; targetHandle: string } {
  if (e.kind === 'exit') return e.backward ? { sourceHandle: 'back-out', targetHandle: 'back-in' } : { sourceHandle: 'out', targetHandle: 'in' };
  if (e.kind === 'contains') return { sourceHandle: 'down', targetHandle: 'in' };
  if (isPlace(target)) return { sourceHandle: 'out', targetHandle: 'cond' };
  return { sourceHandle: 'out', targetHandle: 'in' };
}

// --- Nodes -------------------------------------------------------------------

function QuestNodeView({ data }: NodeProps<QuestNode>) {
  const { graph: n, selected } = data;
  const { color } = NODE_STYLE[n.kind];
  const unreachable = n.kind === 'room' && n.reachable === false;
  return (
    <div
      className="flex h-full w-full flex-col justify-center rounded-lg border-2 bg-slate-950 px-3 text-left shadow-lg"
      style={{
        borderColor: unreachable ? '#f87171' : color,
        borderStyle: unreachable ? 'dashed' : 'solid',
        boxShadow: selected ? `0 0 0 3px ${color}55, 0 0 24px ${color}66` : undefined,
        borderRadius: n.kind === 'flag' ? 999 : undefined,
      }}
    >
      {isPlace(n) ? (
        <>
          <Handle id="in" type="target" position={Position.Left} style={{ top: '35%' }} className={HANDLE} />
          <Handle id="out" type="source" position={Position.Right} style={{ top: '35%' }} className={HANDLE} />
          <Handle id="back-out" type="source" position={Position.Left} style={{ top: '72%' }} className={HANDLE} />
          <Handle id="back-in" type="target" position={Position.Right} style={{ top: '72%' }} className={HANDLE} />
          <Handle id="down" type="source" position={Position.Bottom} style={{ left: 24 }} className={HANDLE} />
          <Handle id="cond" type="target" position={Position.Bottom} style={{ left: '70%' }} className={HANDLE} />
        </>
      ) : (
        <>
          <Handle id="in" type="target" position={Position.Left} className={HANDLE} />
          <Handle id="out" type="source" position={Position.Right} className={HANDLE} />
        </>
      )}
      <div className="flex items-center gap-1.5">
        {n.start && (
          <span className="rounded bg-quantum-500 px-1 font-mono text-[9px] font-bold text-slate-950" aria-label="Start room">
            START
          </span>
        )}
        <span
          className={`text-xs font-bold leading-tight text-slate-100 ${n.kind === 'action' ? 'line-clamp-2' : 'truncate'}`}
          style={{ color: n.kind === 'room' ? undefined : color }}
          title={n.label}
        >
          {n.label}
        </span>
      </div>
      {(n.detail || unreachable) && (
        <span className={`truncate font-mono text-[10px] ${unreachable ? 'text-red-400' : 'text-slate-500'}`}>
          {unreachable ? 'unreachable' : n.detail}
        </span>
      )}
    </div>
  );
}

const HANDLE = '!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent';
/** React Flow's control buttons fill icons with colour; lucide icons are outlines, so keep them unfilled. */
const OUTLINE = { fill: 'none' };

const nodeTypes = { quest: QuestNodeView };

// --- Legend ------------------------------------------------------------------

/** Link-group toggles and the colour key. `compact` is the overlay shown in fullscreen. */
function Legend({ hidden, onToggle, compact = false }: { hidden: Set<EdgeGroup>; onToggle: (group: EdgeGroup) => void; compact?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show links">
        <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">Show</span>
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={!g.toggle}
            aria-pressed={!hidden.has(g.id)}
            onClick={() => onToggle(g.id)}
            className={`${chip} ${hidden.has(g.id) ? chipIdle : chipActive} disabled:cursor-default`}
          >
            {g.name}
          </button>
        ))}
      </div>
      <ul className={`grid gap-x-6 gap-y-1.5 text-xs text-slate-400 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {(Object.keys(NODE_STYLE) as GraphNodeKind[]).map((kind) => (
          <li key={kind} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-5 border-2 bg-slate-950"
              style={{ borderColor: NODE_STYLE[kind].color, borderRadius: kind === 'flag' ? 999 : 4 }}
              aria-hidden
            />
            {NODE_STYLE[kind].name}
          </li>
        ))}
        {(Object.keys(EDGE_STYLE) as GraphEdgeKind[]).map((kind) => (
          <li key={kind} className={`flex items-center gap-2 ${hidden.has(EDGE_STYLE[kind].group) ? 'opacity-40' : ''}`}>
            <svg width="20" height="8" aria-hidden>
              <line
                x1="0"
                y1="4"
                x2="20"
                y2="4"
                stroke={EDGE_STYLE[kind].color}
                strokeWidth="2.5"
                strokeDasharray={EDGE_STYLE[kind].dashed ? '4 3' : undefined}
              />
            </svg>
            {EDGE_STYLE[kind].name}
          </li>
        ))}
      </ul>
    </>
  );
}

// --- Moved nodes ---------------------------------------------------------------

type Positions = Record<string, XYPosition>;
// Bump the version when the automatic layout changes: positions saved for an older layout would be misplaced.
const positionsKey = (levelId: string) => `quest.preview.positions.v2.${levelId}`;

/** Node positions moved by hand, kept per level in this browser only. */
function loadPositions(levelId: string): Positions {
  try {
    return JSON.parse(localStorage.getItem(positionsKey(levelId)) ?? '{}') as Positions;
  } catch {
    return {};
  }
}

function savePositions(levelId: string, positions: Positions): void {
  try {
    if (Object.keys(positions).length) localStorage.setItem(positionsKey(levelId), JSON.stringify(positions));
    else localStorage.removeItem(positionsKey(levelId));
  } catch {
    // Storage unavailable (private mode...): moved nodes just won't survive a reload.
  }
}

// --- Page --------------------------------------------------------------------

export function AdminLevelPreview() {
  const { id = '' } = useParams<{ id: string }>();
  // Keyed by level, so per-level state (moved nodes) starts fresh when the URL changes.
  return <LevelPreview key={id} id={id} />;
}

function LevelPreview({ id }: { id: string }) {
  const { data: level, error, loading, reload } = useApi<Level>(`/api/admin/levels/${encodeURIComponent(id)}`);
  const [hidden, setHidden] = useState<Set<EdgeGroup>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const flowInstance = useRef<ReactFlowInstance<QuestNode> | null>(null);
  /** 'native': browser fullscreen; 'window': fills the window where the Fullscreen API is missing (iPhone). */
  const [fullscreen, setFullscreen] = useState<'off' | 'native' | 'window'>('off');
  const [positions, setPositions] = useState<Positions>(() => loadPositions(id));
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) savePositions(id, positions);
  }, [id, positions]);

  const graph = useMemo(() => (level ? levelGraph(level) : null), [level]);

  const visible = useMemo(() => {
    if (!graph) return null;
    const edges = graph.edges.filter((e) => !hidden.has(EDGE_STYLE[e.kind].group));
    const linked = new Set(edges.flatMap((e) => [e.source, e.target]));
    // Rooms and the exit always show; other nodes only while one of their links is shown.
    const nodes = graph.nodes.filter((n) => n.kind === 'room' || n.kind === 'finish' || linked.has(n.id));
    return { nodes, edges };
  }, [graph, hidden]);

  const flow = useMemo(
    () => (visible ? layoutGraph(visible.nodes, visible.edges, selectedId) : null),
    [visible, selectedId],
  );

  // The automatic layout, with the nodes moved by hand at their new place.
  const nodes = useMemo(
    () => flow?.nodes.map((n) => (positions[n.id] ? { ...n, position: positions[n.id]! } : n)) ?? [],
    [flow, positions],
  );

  const onNodesChange = (changes: NodeChange<QuestNode>[]) => {
    const moved: Positions = {};
    for (const change of changes) {
      if (change.type !== 'position') continue;
      dragging.current = !!change.dragging;
      if (change.position) moved[change.id] = change.position;
    }
    // A new object even without moves: the save effect runs once the drag ends.
    setPositions((current) => ({ ...current, ...moved }));
  };

  const selected = graph?.nodes.find((n) => n.id === selectedId) ?? null;
  const unreachable = graph?.nodes.filter((n) => n.kind === 'room' && !n.reachable) ?? [];
  const count = (kind: GraphNodeKind) => graph?.nodes.filter((n) => n.kind === kind).length ?? 0;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === canvas.current ? 'native' : 'off');
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (fullscreen !== 'window') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen('off');
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // The canvas changes size when entering or leaving fullscreen: fit the entrance side again once it is applied.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      flowInstance.current?.fitView({ nodes: flow?.entrance, maxZoom: 1, padding: 0.15 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [fullscreen]);

  const toggleFullscreen = async () => {
    if (fullscreen === 'native') return void (await document.exitFullscreen());
    if (fullscreen === 'window') return setFullscreen('off');
    if (canvas.current?.requestFullscreen) {
      try {
        await canvas.current.requestFullscreen();
        return;
      } catch {
        // Refused (e.g. inside an iframe): fall back to filling the window.
      }
    }
    setFullscreen('window');
  };

  const toggle = (group: EdgeGroup) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <div className="space-y-6">
      <Link to="/admin/levels" className="inline-flex items-center text-sm text-slate-400 hover:text-white">
        <ChevronLeft size={16} aria-hidden /> Back to levels
      </Link>
      <PageHeader
        title={level ? `Preview: ${level.title}` : 'Level preview'}
        subtitle={
          graph
            ? `${count('room')} rooms · ${count('item')} items · ${count('action')} actions · ${count('flag')} flags · ${level?.points} pts, par ${level?.par}`
            : 'How rooms, items and actions connect.'
        }
        icon={<Network className="text-quantum-400" aria-hidden />}
      />

      {loading && !level ? (
        <Loading label="Loading level…" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title="Could not load the level" />
      ) : graph && flow ? (
        <>
          {unreachable.length > 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              <AlertTriangle size={16} aria-hidden />
              No exit leads to: {unreachable.map((n) => n.label).join(', ')}.
            </p>
          )}

          <div className={`${card} space-y-3 p-4`}>
            <Legend hidden={hidden} onToggle={toggle} />
            <p className="text-xs text-slate-500">
              Dashed exits (🔒) need a condition. Click a node to highlight its links and read its text; drag it to move it.
            </p>
          </div>

          <div
            ref={canvas}
            className={`overflow-hidden bg-slate-950 ${
              fullscreen === 'off'
                ? 'relative h-[70vh] min-h-[28rem] rounded-xl border border-slate-800'
                : fullscreen === 'window'
                  ? 'fixed inset-0 z-50'
                  : 'relative h-full w-full'
            }`}
          >
            <ReactFlow
              key={[...hidden].join()}
              nodes={nodes}
              edges={flow.edges}
              nodeTypes={nodeTypes}
              colorMode="dark"
              // The level reads left to right, entrance to exit: open readable on the entrance side, then pan.
              fitView
              fitViewOptions={{ nodes: flow.entrance, maxZoom: 1, padding: 0.15 }}
              onInit={(instance) => {
                flowInstance.current = instance;
              }}
              minZoom={0.1}
              nodesDraggable
              onNodesChange={onNodesChange}
              nodesConnectable={false}
              elementsSelectable={false}
              onNodeClick={(_, node) => setSelectedId((current) => (current === node.id ? null : node.id))}
              onPaneClick={() => setSelectedId(null)}
            >
              <Background color="#1e293b" bgColor="#020617" gap={24} />
              <Controls showInteractive={false} position="bottom-left">
                <ControlButton
                  onClick={toggleFullscreen}
                  aria-label={fullscreen === 'off' ? 'Fullscreen' : 'Exit fullscreen'}
                  title={fullscreen === 'off' ? 'Fullscreen' : 'Exit fullscreen (Esc)'}
                >
                  {fullscreen === 'off' ? <Maximize2 aria-hidden style={OUTLINE} /> : <Minimize2 aria-hidden style={OUTLINE} />}
                </ControlButton>
                {Object.keys(positions).length > 0 && (
                  <ControlButton onClick={() => setPositions({})} aria-label="Reset layout" title="Reset layout (undo moved nodes)">
                    <RotateCcw aria-hidden style={OUTLINE} />
                  </ControlButton>
                )}
              </Controls>
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                bgColor="#0f172a"
                maskColor="rgba(2, 6, 23, 0.7)"
                nodeColor={(n) => NODE_STYLE[(n as QuestNode).data.graph.kind].color}
                ariaLabel="Level overview"
              />
            </ReactFlow>

            {fullscreen !== 'off' && (
              <details className="absolute left-3 top-3 max-h-[calc(100%-1.5rem)] w-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl">
                <summary className="cursor-pointer text-sm font-bold text-white">
                  {level?.title} <span className="font-normal text-slate-400">· legend</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <Legend hidden={hidden} onToggle={toggle} compact />
                </div>
              </details>
            )}

            {selected && (
              <aside
                className="absolute right-3 top-3 w-72 max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl"
                aria-label="Selected node"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: NODE_STYLE[selected.kind].color }}>
                      {NODE_STYLE[selected.kind].name}
                      {selected.detail ? ` · ${selected.detail}` : ''}
                    </p>
                    <h2 className="font-bold text-white">{selected.label}</h2>
                  </div>
                  <button type="button" className={`${btnGhost} ${btnSmall}`} onClick={() => setSelectedId(null)} aria-label="Close details">
                    <X size={14} aria-hidden />
                  </button>
                </div>
                {selected.description && <p className="text-sm leading-relaxed text-slate-300">{selected.description}</p>}
                <ul className="mt-3 space-y-1 border-t border-slate-800 pt-3 font-mono text-[11px] text-slate-400">
                  {graph.edges
                    .filter((e) => e.source === selected.id || e.target === selected.id)
                    .map((e) => {
                      const out = e.source === selected.id;
                      const other = graph.nodes.find((n) => n.id === (out ? e.target : e.source));
                      return (
                        <li key={e.id} style={{ color: EDGE_STYLE[e.kind].color }}>
                          {out ? '→' : '←'} {e.kind}
                          {e.label ? ` (${e.label})` : ''}: <span className="text-slate-300">{other?.label}</span>
                        </li>
                      );
                    })}
                </ul>
              </aside>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
