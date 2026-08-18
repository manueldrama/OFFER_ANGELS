import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    rectSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { SortableWidget } from './SortableWidget';
import { KpiWidget } from './widgets/KpiWidget';
import { usePendingBankTransfersCount } from '../../../hooks/usePendingBankTransfersCount';
import { FunnelWidget } from './widgets/FunnelWidget';
import { ActivityWidget } from './widgets/ActivityWidget';
import { RevenueChartWidget } from './widgets/RevenueChartWidget';
import { RecentOffersWidget } from './widgets/RecentOffersWidget';
import { SupportInboxWidget } from './widgets/SupportInboxWidget';
import { RecentReservationsWidget } from './widgets/RecentReservationsWidget';
import { PendingShipmentsWidget } from './widgets/PendingShipmentsWidget';
import { UrgentDepositsWidget } from './widgets/UrgentDepositsWidget';
import { TodayActivityWidget } from './widgets/TodayActivityWidget';
import { SiteAnalyticsWidget } from './widgets/SiteAnalyticsWidget';
import { RemindersWidget } from './widgets/RemindersWidget';
import { TasksWidget } from './widgets/TasksWidget';
import type { DashboardReportMetrics } from '../../../services/admin/dashboardReportingService';
import type { WidgetId } from '../../../hooks/useDashboardLayout';

interface DashboardGridProps {
    layout: WidgetId[];
    setLayout: (layout: WidgetId[]) => void;
    isEditMode: boolean;
    metrics: DashboardReportMetrics | null;
    onHideWidget?: (id: WidgetId) => void;
}

// Widget column spans for the 4-column grid
const WIDGET_COL_SPAN: Partial<Record<WidgetId, string>> = {
    'reminders': 'sm:col-span-2 lg:col-span-2',
    'tasks': 'sm:col-span-2 lg:col-span-2',
    'support-inbox': 'sm:col-span-2 lg:col-span-2',
    'revenue-chart': 'sm:col-span-2 lg:col-span-3',
    'funnel': 'sm:col-span-2 lg:col-span-1',
    'recent-offers': 'sm:col-span-2 lg:col-span-3',
    'activity': 'sm:col-span-2 lg:col-span-1',
    'recent-reservations': 'sm:col-span-2 lg:col-span-2',
    'pending-shipments': 'sm:col-span-2 lg:col-span-2',
    'urgent-deposits': 'sm:col-span-2 lg:col-span-2',
    'today-activity': 'sm:col-span-2 lg:col-span-1',
    'site-analytics': 'sm:col-span-2 lg:col-span-2',
};

export function DashboardGrid({ layout, setLayout, isEditMode, metrics, onHideWidget }: DashboardGridProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor),
    );
    const pendingBankTransfers = usePendingBankTransfersCount();

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = layout.indexOf(active.id as WidgetId);
            const newIndex = layout.indexOf(over.id as WidgetId);
            setLayout(arrayMove(layout, oldIndex, newIndex));
        }
    }

    function renderWidget(id: WidgetId) {
        if (id === 'reminders') {
            return <RemindersWidget />;
        }
        if (id === 'tasks') {
            return <TasksWidget />;
        }
        if (id === 'kpi-bank-transfers-pending') {
            return <KpiWidget variant={id} metrics={metrics} overrideValue={pendingBankTransfers} />;
        }
        if (id.startsWith('kpi-')) {
            return <KpiWidget variant={id} metrics={metrics} />;
        }
        if (id === 'revenue-chart') {
            return <RevenueChartWidget />;
        }
        if (id === 'funnel') {
            return <FunnelWidget metrics={metrics} />;
        }
        if (id === 'recent-offers') {
            return <RecentOffersWidget />;
        }
        if (id === 'support-inbox') {
            return <SupportInboxWidget />;
        }
        if (id === 'activity') {
            return <ActivityWidget />;
        }
        if (id === 'recent-reservations') {
            return <RecentReservationsWidget />;
        }
        if (id === 'pending-shipments') {
            return <PendingShipmentsWidget />;
        }
        if (id === 'urgent-deposits') {
            return <UrgentDepositsWidget />;
        }
        if (id === 'today-activity') {
            return <TodayActivityWidget />;
        }
        if (id === 'site-analytics') {
            return <SiteAnalyticsWidget />;
        }
        return null;
    }

    if (layout.length === 0) {
        return (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
                <p className="text-sm font-semibold text-slate-700">Tüm modüller gizli</p>
                <p className="text-xs text-slate-500 mt-1">Düzenle moduna geçip "Modül Ekle" ile geri getirebilirsiniz.</p>
            </div>
        );
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={layout} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                    {layout.map(id => (
                        <SortableWidget
                            key={id}
                            id={id}
                            isEditMode={isEditMode}
                            className={WIDGET_COL_SPAN[id] || ''}
                            onHide={onHideWidget ? () => onHideWidget(id) : undefined}
                        >
                            {renderWidget(id)}
                        </SortableWidget>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
