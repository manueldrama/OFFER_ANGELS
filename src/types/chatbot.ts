// ── Chatbot Flow Builder Types ──

// ─── Flow ───────────────────────────────────────────
export type ChatbotChannel = 'whatsapp' | 'instagram' | 'all';

export type ChatbotTriggerType =
    | 'keyword'
    | 'comment_keyword'
    | 'story_mention'
    | 'new_follower'
    | 'manual';

export interface FlowTriggerConfig {
    keywords?: string[];
    match_type?: 'exact' | 'contains' | 'starts_with';
    post_ids?: string[];           // comment_keyword: specific posts only
    reply_to_comment?: boolean;    // comment_keyword: also reply to comment
}

export interface ChatbotFlow {
    id: string;
    name: string;
    description: string | null;
    channel: ChatbotChannel;
    trigger_type: ChatbotTriggerType;
    trigger_config: FlowTriggerConfig;
    flow_data: { nodes: FlowNode[]; edges: FlowEdge[] };
    is_active: boolean;
    stats_triggered: number;
    stats_completed: number;
    stats_failed: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// ─── Flow Graph (ReactFlow serialized) ──────────────
export type FlowNodeType =
    | 'trigger'
    | 'sendMessage'
    | 'sendImage'
    | 'sendButton'
    | 'sendCarousel'
    | 'delay'
    | 'condition'
    | 'randomSplit'
    | 'tagSubscriber'
    | 'httpRequest';

export interface FlowNodeBase {
    id: string;
    type: FlowNodeType;
    position: { x: number; y: number };
    data: FlowNodeData;
}

export type FlowNode = FlowNodeBase;

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
}

// ─── Node Data (discriminated union) ────────────────
export type FlowNodeData =
    | TriggerNodeData
    | SendMessageNodeData
    | SendImageNodeData
    | SendButtonNodeData
    | SendCarouselNodeData
    | DelayNodeData
    | ConditionNodeData
    | RandomSplitNodeData
    | TagSubscriberNodeData
    | HttpRequestNodeData;

export interface TriggerNodeData {
    nodeType: 'trigger';
    label: string;
    triggerType: ChatbotTriggerType;
    keywords?: string[];
    matchType?: 'exact' | 'contains' | 'starts_with';
}

export interface SendMessageNodeData {
    nodeType: 'sendMessage';
    label: string;
    message: string;  // supports {{subscriber.name}}, {{subscriber.custom_fields.X}}
}

export interface SendImageNodeData {
    nodeType: 'sendImage';
    label: string;
    imageUrl: string;
    caption?: string;
}

export interface SendButtonNodeData {
    nodeType: 'sendButton';
    label: string;
    message: string;
    buttons: { id: string; title: string }[];  // max 3 for WhatsApp, handles map to button IDs
}

export interface SendCarouselNodeData {
    nodeType: 'sendCarousel';
    label: string;
    elements: {
        title: string;
        subtitle?: string;
        imageUrl?: string;
        buttons?: { title: string; url?: string; payload?: string }[];
    }[];
}

export interface DelayNodeData {
    nodeType: 'delay';
    label: string;
    duration: number;
    unit: 'minutes' | 'hours' | 'days';
}

export interface ConditionNodeData {
    nodeType: 'condition';
    label: string;
    field: string;       // e.g. 'last_input', 'subscriber.tags', 'context.X'
    operator: 'equals' | 'contains' | 'not_equals' | 'exists' | 'not_exists' | 'includes';
    value: string;
}

export interface RandomSplitNodeData {
    nodeType: 'randomSplit';
    label: string;
    splits: { id: string; percentage: number; label: string }[];
}

export interface TagSubscriberNodeData {
    nodeType: 'tagSubscriber';
    label: string;
    action: 'add' | 'remove';
    tags: string[];
}

export interface HttpRequestNodeData {
    nodeType: 'httpRequest';
    label: string;
    method: 'GET' | 'POST' | 'PUT';
    url: string;
    headers?: Record<string, string>;
    body?: string;
    saveResponseAs?: string;  // variable name in context
}

// ─── Subscriber ─────────────────────────────────────
export interface ChatbotSubscriber {
    id: string;
    channel: 'whatsapp' | 'instagram';
    platform_user_id: string;
    display_name: string | null;
    profile_pic_url: string | null;
    lead_id: string | null;
    tags: string[];
    custom_fields: Record<string, any>;
    last_interaction_at: string | null;
    is_blocked: boolean;
    created_at: string;
    updated_at: string;
}

// ─── Flow Run ───────────────────────────────────────
export type FlowRunStatus = 'running' | 'completed' | 'failed' | 'paused' | 'waiting_input';

export interface ChatbotFlowRun {
    id: string;
    flow_id: string;
    subscriber_id: string;
    status: FlowRunStatus;
    current_node_id: string | null;
    context: Record<string, any>;
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
    // Joined fields
    flow?: ChatbotFlow;
    subscriber?: ChatbotSubscriber;
}

export interface ChatbotFlowRunStep {
    id: string;
    run_id: string;
    node_id: string;
    node_type: string;
    status: 'executed' | 'failed' | 'skipped';
    input_data: Record<string, any> | null;
    output_data: Record<string, any> | null;
    executed_at: string;
}

// ─── Instagram Config ───────────────────────────────
export interface ChatbotInstagramConfig {
    id: string;
    instagram_page_id: string | null;
    instagram_account_id: string | null;
    access_token: string | null;
    webhook_verify_token: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ─── Dashboard Stats ────────────────────────────────
export interface ChatbotDashboardStats {
    totalFlows: number;
    activeFlows: number;
    totalSubscribers: number;
    whatsappSubscribers: number;
    instagramSubscribers: number;
    runsToday: number;
    runsCompleted: number;
    runsFailed: number;
}
