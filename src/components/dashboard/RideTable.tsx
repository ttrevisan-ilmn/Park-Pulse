"use client";

import React, { useState } from "react";
import { Ride, WaitTimeSnapshot } from "@/lib/types";
import { format } from "date-fns";
import { CSS } from "@dnd-kit/utilities";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { GripVertical, ChevronUp, ChevronDown, Star, Bell, TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";
import { getLand, getTicketClass } from "@/lib/parks";
import { WaitTimeChart } from "../WaitTimeChart";
import { WaitTimeSparkline } from "../WaitTimeSparkline";
import { Alert } from "@/hooks/useAlerts";

// Type definitions for internal usage in this component
export type SortField = 'name' | 'waitTime' | 'land' | 'status' | 'ticket' | 'peak' | 'favorite';
export type SortDirection = 'asc' | 'desc';

interface ColumnDef {
    id: string;
    label: string | React.ReactNode;
    field?: SortField;
    isSortable: boolean;
    className?: string;
}

interface RideTableProps {
    rides: Ride[];
    searchQuery: string;
    expandedRideId: string | null;
    setExpandedRideId: (id: string | null) => void;
    history: WaitTimeSnapshot[];
    sortField: SortField;
    sortDirection: SortDirection;
    handleSort: (field: SortField) => void;
    getHighOfDay: (ride: Ride) => number;
    showHours: boolean;
    TARGET_HOURS: number[];
    favorites: string[];
    toggleFavorite: (id: string) => void;
    alerts: Alert[];
    onToggleAlert: (id: string, name: string) => void;
}

// Draggable Header Component
function DraggableHeader({
    column,
    currentSort,
    direction,
    onSort,
    isSticky
}: {
    column: ColumnDef,
    currentSort: SortField,
    direction: SortDirection,
    onSort: (f: SortField) => void,
    isSticky: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: column.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isSticky ? 20 : (isDragging ? 50 : 'auto'),
        touchAction: 'none', // Prevent scrolling while dragging handle
    };

    return (
        <th
            ref={setNodeRef}
            style={style}
            className={cn(
                "px-6 py-4 font-semibold text-gray-900 dark:text-gray-100 select-none group relative bg-gray-50 dark:bg-zinc-900",
                isSticky && "sticky left-0 shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.1)]",
                isDragging && "opacity-50 bg-gray-200",
                column.className
            )}
        >
            <div className="flex items-center gap-2">
                <button
                    {...attributes}
                    {...listeners}
                    className="p-2 -ml-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-5 h-5" />
                </button>

                <div
                    className={cn("flex items-center gap-1 flex-1", column.isSortable && "cursor-pointer hover:text-blue-600")}
                    onClick={() => column.isSortable && column.field && onSort(column.field)}
                >
                    {column.label}
                    {column.isSortable && (
                        <div className="flex flex-col">
                            <ChevronUp className={cn("w-3 h-3 -mb-1", currentSort === column.field && direction === 'asc' ? "text-blue-600" : "text-gray-300")} />
                            <ChevronDown className={cn("w-3 h-3", currentSort === column.field && direction === 'desc' ? "text-blue-600" : "text-gray-300")} />
                        </div>
                    )}
                </div>
            </div>
        </th>
    );
}

export function RideTable({
    rides,
    searchQuery,
    expandedRideId,
    setExpandedRideId,
    history,
    sortField,
    sortDirection,
    handleSort,
    getHighOfDay,
    showHours,
    TARGET_HOURS,
    favorites,
    toggleFavorite,
    alerts,
    onToggleAlert
}: RideTableProps) {

    const baseColumns: ColumnDef[] = [
        { id: 'name', label: 'Ride Name', field: 'name', isSortable: true, className: "w-64" },
        { id: 'waitTime', label: 'Wait Time', field: 'waitTime', isSortable: true, className: "w-24" },
        { id: 'actions', label: 'Actions', isSortable: false, className: "w-20 text-center" },
        { id: 'ticket', label: 'Ticket', field: 'ticket', isSortable: true, className: "w-20" },
        { id: 'status', label: 'Status', field: 'status', isSortable: true, className: "w-24" },
        { id: 'land', label: 'Land', field: 'land', isSortable: true, className: "w-40" },
        { id: 'peak', label: 'Peak (Est)', field: 'peak', isSortable: true, className: "w-24" },
        { id: 'trend', label: 'Trend', className: "w-48", isSortable: false },
    ];

    const hourlyColumns: ColumnDef[] = TARGET_HOURS.map(h => ({
        id: `hour-${h}`,
        label: format(new Date().setHours(h), 'ha'),
        className: "w-16 text-center",
        isSortable: false
    }));

    const allInitialIds = [
        ...baseColumns.map(c => c.id),
        ...hourlyColumns.map(c => c.id),
    ];

    const [columnOrder, setColumnOrder] = useState<string[]>(allInitialIds);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setColumnOrder((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over?.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const visibleColumns = useMemo(() => {
        return columnOrder.map(id => {
            const base = baseColumns.find(c => c.id === id);
            if (base) return base;
            const hourly = hourlyColumns.find(c => c.id === id);
            if (hourly && showHours) return hourly;
            return null;
        }).filter(Boolean) as ColumnDef[];
    }, [columnOrder, showHours]);

    const getForecastForHour = (ride: Ride, hourId: string) => {
        const h = parseInt(hourId.replace('hour-', ''));
        if (!ride.forecast) return "-";
        const match = ride.forecast.find(f => {
            const d = new Date(f.time);
            return d.getHours() === h;
        });
        return match ? `${match.waitTime}` : "-";
    };

    const renderCell = (ride: Ride, colId: string) => {
        if (colId === 'actions') {
            const isFav = favorites.includes(ride.id);
            const hasAlert = alerts.some(a => a.rideId === ride.id);
            return (
                <div className="flex gap-1 justify-center">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleAlert(ride.id, ride.name);
                        }}
                        className={cn(
                            "p-1 rounded-full transition-colors focus:outline-none",
                            hasAlert
                                ? "text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                                : "text-gray-300 hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
                        )}
                        title={hasAlert ? "Remove alert" : "Set wait time alert"}
                    >
                        <Bell className={cn("w-4 h-4", hasAlert && "fill-current")} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(ride.id);
                        }}
                        className={cn("p-1 rounded-full transition-colors focus:outline-none",
                            isFav
                                ? "text-yellow-500 hover:text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
                                : "text-gray-300 hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
                        )}
                    >
                        <Star className={cn("w-4 h-4", isFav && "fill-current")} />
                    </button>
                </div>
            );
        }
        if (colId === 'name') {
            return <div className="font-medium text-gray-900 dark:text-white">{ride.name}</div>;
        }
        if (colId === 'land') {
            const land = getLand(ride.name);
            let colorClass = "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400";

            if (land.includes("Tomorrowland")) colorClass = "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
            if (land.includes("Adventureland")) colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
            if (land.includes("New Orleans")) colorClass = "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
            if (land.includes("Galaxy's Edge")) colorClass = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
            if (land.includes("Fantasyland")) colorClass = "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800";
            if (land.includes("Frontierland")) colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
            if (land.includes("Cars Land")) colorClass = "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
            if (land.includes("Pixar Pier")) colorClass = "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
            if (land.includes("Avengers")) colorClass = "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
            if (land.includes("Toontown")) colorClass = "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800";
            if (land.includes("Grizzly Peak")) colorClass = "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
            if (land.includes("Hollywood Land")) colorClass = "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-fuchsia-800";

            return (
                <span className={cn("text-xs font-medium px-2 py-1 rounded border whitespace-nowrap", colorClass)}>
                    {land}
                </span>
            );
        }
        if (colId === 'ticket') {
            const ticket = getTicketClass(ride.name);
            if (ticket === '—') return <span className="text-gray-300">-</span>;

            let badgeColor = "bg-gray-100 text-gray-600";
            if (ticket === 'E') badgeColor = "bg-purple-100 text-purple-700 border-purple-200";
            if (ticket === 'D') badgeColor = "bg-blue-100 text-blue-700 border-blue-200";
            if (ticket === 'C') badgeColor = "bg-cyan-100 text-cyan-700 border-cyan-200";

            return (
                <span className={cn("px-2 py-0.5 rounded text-xs font-bold border", badgeColor)}>
                    {ticket}
                </span>
            );
        }
        if (colId === 'status') {
            return (
                <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                    ride.status === 'OPERATING' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        ride.status === 'CLOSED' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300"
                )}>
                    {ride.status === 'OPERATING' ? 'Open' : ride.status}
                </span>
            );
        }
        if (colId === 'waitTime') {
            return ride.status === 'OPERATING' ? (
                <span className={cn(
                    "font-bold text-base",
                    (ride.queue?.STANDBY?.waitTime || 0) > 45 ? "text-red-600 dark:text-red-400" :
                        (ride.queue?.STANDBY?.waitTime || 0) > 20 ? "text-yellow-600 dark:text-yellow-400" :
                            "text-green-600 dark:text-green-400"
                )}>
                    {ride.queue?.STANDBY?.waitTime ?? 0}
                </span>
            ) : <span className="text-gray-400">-</span>;
        }
        if (colId === 'peak') {
            return <span className="text-gray-600 dark:text-gray-400">{getHighOfDay(ride)}</span>;
        }
        if (colId === 'trend') {
            return <WaitTimeSparkline forecast={ride.forecast || []} />;
        }
        if (colId.startsWith('hour-')) {
            const valStr = getForecastForHour(ride, colId);
            const val = parseInt(valStr);
            let bgClass = "";
            if (!isNaN(val)) {
                if (val < 15) bgClass = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
                else if (val < 35) bgClass = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
                else if (val < 60) bgClass = "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
                else bgClass = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
            }
            return (
                <div className={cn("py-1.5 rounded mx-1 text-center text-xs", bgClass || "text-gray-400")}>
                    {valStr}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <table className="w-full text-left text-sm relative border-collapse">
                        <thead className="bg-gray-50 dark:bg-zinc-900 border-b">
                            <tr>
                                <SortableContext items={visibleColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                                    {visibleColumns.map((col, idx) => (
                                        <DraggableHeader
                                            key={col.id}
                                            column={col}
                                            currentSort={sortField}
                                            direction={sortDirection}
                                            onSort={handleSort}
                                            isSticky={idx === 0}
                                        />
                                    ))}
                                </SortableContext>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-700">
                            {rides.map((ride) => (
                                <React.Fragment key={ride.id}>
                                    <tr
                                        className={cn(
                                            "group transition-colors cursor-pointer",
                                            expandedRideId === ride.id
                                                ? "bg-blue-50/50 dark:bg-blue-900/10"
                                                : "hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                                        )}
                                        onClick={() => setExpandedRideId(expandedRideId === ride.id ? null : ride.id)}
                                    >
                                        {visibleColumns.map((col, idx) => (
                                            <td
                                                key={col.id}
                                                className={cn(
                                                    "px-6 py-4",
                                                    idx === 0 && "sticky left-0 z-10 bg-white group-hover:bg-gray-50 dark:bg-zinc-800 dark:group-hover:bg-zinc-700/50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] transition-colors",
                                                    expandedRideId === ride.id && idx === 0 && "bg-blue-50/50 dark:bg-blue-900/10 group-hover:bg-blue-50/50",
                                                    col.className
                                                )}
                                            >
                                                {renderCell(ride, col.id)}
                                            </td>
                                        ))}
                                    </tr>
                                    {expandedRideId === ride.id && (
                                        <tr className="bg-blue-50/30 dark:bg-blue-900/5 animate-in fade-in slide-in-from-top-2">
                                            <td colSpan={visibleColumns.length} className="px-6 py-4">
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="text-sm font-semibold">Live Wait Time Trend</h4>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                                            <TrendingUp className="w-3 h-3" />
                                                            High of Day: <span className="font-bold text-gray-700 dark:text-gray-300">{getHighOfDay(ride)} min</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-full h-64">
                                                        <WaitTimeChart rideId={ride.id} ride={ride} history={history} />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </DndContext>
            </div>
            {rides.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No rides found matching "{searchQuery}"
                </div>
            )}
        </div>
    );
}
