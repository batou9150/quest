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
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, ChevronLeft, Maximize2, Minimize2, Network, X } from 'lucide-react';
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

/** Left-to-right layered layout. Exits weigh more, so the map forms the backbone from entrance to exit. */
function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string | null,
): { nodes: QuestNode[]; edges: Edge[]; entrance: Array<{ id: string }> } {
  const g = new Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_STYLE[n.kind].width, height: NODE_STYLE[n.kind].height });
  // Exits leading back toward the start would create loops; leave them out of the layout (they are still drawn).
  for (const e of edges.filter((e) => !e.backward)) {
    g.setEdge(e.source, e.target, { weight: e.kind === 'exit' ? 8 : 1, minlen: 1 }, e.id);
  }
  layout(g);

  const left = Math.min(...nodes.map((n) => g.node(n.id).x));
  return {
    entrance: nodes.filter((n) => g.node(n.id).x - left < 1100).map((n) => ({ id: n.id })),
    nodes: nodes.map((n) => {
      const { x, y } = g.node(n.id);
      const { width, height } = NODE_STYLE[n.kind];
      return {
        id: n.id,
        type: 'quest',
        position: { x: x - width / 2, y: y - height / 2 },
        data: { graph: n, selected: n.id === selectedId },
        width,
        height,
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
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
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
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

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

// --- Page --------------------------------------------------------------------

export function AdminLevelPreview() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: level, error, loading, reload } = useApi<Level>(`/api/admin/levels/${encodeURIComponent(id)}`);
  const [hidden, setHidden] = useState<Set<EdgeGroup>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const flowInstance = useRef<ReactFlowInstance<QuestNode> | null>(null);
  /** 'native': browser fullscreen; 'window': fills the window where the Fullscreen API is missing (iPhone). */
  const [fullscreen, setFullscreen] = useState<'off' | 'native' | 'window'>('off');

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
              Dashed exits (🔒) need a condition. Click a node to highlight its links and read its text.
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
              nodes={flow.nodes}
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
              nodesDraggable={false}
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
                  {fullscreen === 'off' ? <Maximize2 aria-hidden /> : <Minimize2 aria-hidden />}
                </ControlButton>
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
