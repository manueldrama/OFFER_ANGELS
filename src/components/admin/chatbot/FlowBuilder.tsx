import React, { useCallback, useRef, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type NodeTypes,
    BackgroundVariant,
    ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TriggerNode from './nodes/TriggerNode';
import SendMessageNode from './nodes/SendMessageNode';
import SendImageNode from './nodes/SendImageNode';
import SendButtonNode from './nodes/SendButtonNode';
import SendCarouselNode from './nodes/SendCarouselNode';
import DelayNode from './nodes/DelayNode';
import ConditionNode from './nodes/ConditionNode';
import RandomSplitNode from './nodes/RandomSplitNode';
import TagSubscriberNode from './nodes/TagSubscriberNode';
import HttpRequestNode from './nodes/HttpRequestNode';
import NodePalette from './NodePalette';
import NodePropertyEditor from './NodePropertyEditor';
import type { FlowNode, FlowEdge, FlowNodeData, FlowNodeType } from '../../../types/chatbot';

const nodeTypes: NodeTypes = {
    trigger: TriggerNode,
    sendMessage: SendMessageNode,
    sendImage: SendImageNode,
    sendButton: SendButtonNode,
    sendCarousel: SendCarouselNode,
    delay: DelayNode,
    condition: ConditionNode,
    randomSplit: RandomSplitNode,
    tagSubscriber: TagSubscriberNode,
    httpRequest: HttpRequestNode,
};

interface FlowBuilderProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: (nodes: Node[]) => void;
    onEdgesChange: (edges: Edge[]) => void;
}

export default function FlowBuilder({ nodes, edges, onNodesChange, onEdgesChange }: FlowBuilderProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const dragDataRef = useRef<{ type: FlowNodeType; data: Record<string, any> } | null>(null);

    const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        const updated = applyNodeChanges(changes, nodes);
        onNodesChange(updated as Node[]);
    }, [nodes, onNodesChange]);

    const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
        const updated = applyEdgeChanges(changes, edges);
        onEdgesChange(updated as Edge[]);
    }, [edges, onEdgesChange]);

    const handleConnect: OnConnect = useCallback((params) => {
        const newEdges = addEdge({
            ...params,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
        }, edges);
        onEdgesChange(newEdges as Edge[]);
    }, [edges, onEdgesChange]);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/chatbot-node');
        if (!raw) return;
        const { type, data } = JSON.parse(raw);

        if (!reactFlowInstance || !reactFlowWrapper.current) return;
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.screenToFlowPosition({
            x: e.clientX - bounds.left,
            y: e.clientY - bounds.top,
        });

        const newNode: Node = {
            id: `${type}_${Date.now()}`,
            type,
            position,
            data,
        };

        onNodesChange([...nodes, newNode]);
    }, [reactFlowInstance, nodes, onNodesChange]);

    const handleNodeDataChange = useCallback((nodeId: string, data: FlowNodeData) => {
        const updated = nodes.map(n => n.id === nodeId ? { ...n, data } : n);
        onNodesChange(updated as Node[]);
    }, [nodes, onNodesChange]);

    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const handlePaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    return (
        <div className="flex h-full">
            <NodePalette onDragStart={(type, data) => { dragDataRef.current = { type, data }; }} />
            <div ref={reactFlowWrapper} className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={handleConnect}
                    onInit={setReactFlowInstance}
                    onNodeClick={handleNodeClick}
                    onPaneClick={handlePaneClick}
                    nodeTypes={nodeTypes}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    deleteKeyCode={['Backspace', 'Delete']}
                    snapToGrid
                    snapGrid={[15, 15]}
                >
                    <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="#e2e8f0" />
                    <Controls className="!bg-white !border-slate-200 !rounded-lg !shadow-sm" />
                    <MiniMap
                        className="!bg-white !border-slate-200 !rounded-lg !shadow-sm"
                        nodeColor={(n) => {
                            switch (n.type) {
                                case 'trigger': return '#22c55e';
                                case 'sendMessage': return '#3b82f6';
                                case 'sendImage': return '#6366f1';
                                case 'sendButton': return '#06b6d4';
                                case 'sendCarousel': return '#8b5cf6';
                                case 'delay': return '#f59e0b';
                                case 'condition': return '#f97316';
                                case 'randomSplit': return '#ec4899';
                                case 'tagSubscriber': return '#14b8a6';
                                case 'httpRequest': return '#475569';
                                default: return '#94a3b8';
                            }
                        }}
                    />
                </ReactFlow>
            </div>
            {selectedNode && (
                <NodePropertyEditor
                    node={selectedNode as unknown as FlowNode}
                    onChange={handleNodeDataChange}
                    onClose={() => setSelectedNodeId(null)}
                />
            )}
        </div>
    );
}
