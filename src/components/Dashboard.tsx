"use client";

import { useState, useMemo } from "react";
import { WaitTimeSnapshot, LiveStatus } from "@/lib/types";
import { RideCard } from "@/components/RideCard";
import { WaitTimeChart } from "@/components/WaitTimeChart";
import { WaitTimeSparkline } from "@/components/WaitTimeSparkline";
import { PARKS, PARK_NAMES, getLand, getTicketClass } from "@/lib/parks";
import { Search, RefreshCw, LayoutGrid, List as ListIcon, TrendingUp, ChevronDown, ChevronUp, GripVertical, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// DnD Kit imports
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
import { CSS } from "@dnd-kit/utilities";

interface DashboardProps {
    initialData: { current: WaitTimeSnapshot; history: WaitTimeSnapshot[] } | null;
    error: string | null;
}

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'status' | 'waitTime' | 'land' | 'peak' | 'ticket';
type SortDirection = 'asc' | 'desc';

const TARGET_HOURS = [9, 11, 13, 15, 17, 19, 21];

interface ColumnDef {
    id: string;
    label: string;
    field?: SortField;
    className?: string;
    isSortable?: boolean;
}

export function Dashboard({ initialData, error }: DashboardProps) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const [selectedParkId, setSelectedParkId] = useState(PARKS.DISNEYLAND_PARK);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    // Sorting State
    const [sortField, setSortField] = useState<SortField>('waitTime');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Column Visibility & Order
    const [showHours, setShowHours] = useState(false);

    const baseColumns: ColumnDef[] = [
        { id: 'name', label: 'Ride Name', field: 'name', isSortable: true, className: "w-64" },
        { id: 'waitTime', label: 'Wait Time', field: 'waitTime', isSortable: true, className: "w-24" },
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
        ...baseColumns.slice(0, 6).map(c => c.id), // Includes Ticket now
        ...hourlyColumns.map(c => c.id),
        'trend'
    ];
    const [columnOrder, setColumnOrder] = useState<string[]>(allInitialIds);

    const [expandedRideId, setExpandedRideId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 100, tolerance: 5 } }), // Delay helps prevent accidental drags on mobile scroll
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


    const refreshData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/waittimes");
            const json = await res.json();
            if (json.current) {
                setData(json);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const currentParkData = data?.current.parks.find((p) => p.id === selectedParkId);

    const getHighOfDay = (ride: LiveStatus) => {
        if (!ride.forecast) return 0;
        return Math.max(...ride.forecast.map(f => f.waitTime));
    };

    const getForecastForHour = (ride: LiveStatus, hourId: string) => {
        const h = parseInt(hourId.replace('hour-', ''));
        if (!ride.forecast) return "-";
        const match = ride.forecast.find(f => {
            const d = new Date(f.time);
            return d.getHours() === h;
        });
        return match ? `${match.waitTime}` : "-";
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default desc for Ticket (E -> A) and Numbers
        }
    };

    // Filter & Sort
    const filteredRides = useMemo(() => {
        if (!currentParkData) return [];

        let rides = currentParkData.liveData
            .filter((entity) => entity.entityType === "ATTRACTION")
            .filter((ride) =>
                ride.name.toLowerCase().includes(searchQuery.toLowerCase())
            );

        // Sort
        rides = rides.sort((a, b) => {
            let valA: string | number = 0;
            let valB: string | number = 0;

            switch (sortField) {
                case 'name':
                    valA = a.name;
                    valB = b.name;
                    break;
                case 'status':
                    valA = a.status;
                    valB = b.status;
                    break;
                case 'land':
                    valA = getLand(a.name);
                    valB = getLand(b.name);
                    break;
                case 'ticket':
                    // For ticket, we want E > D > C... so reverse string sort works if we want 'E' first.
                    // Actually 'E' > 'A' in string comparison? No 'E' is 69, 'A' is 65.
                    // So DESC sort ('desc') means E comes before A.
                    valA = getTicketClass(a.name);
                    valB = getTicketClass(b.name);
                    break;
                case 'waitTime':
                    valA = a.queue?.STANDBY?.waitTime ?? (a.status === "OPERATING" ? -1 : -2);
                    valB = b.queue?.STANDBY?.waitTime ?? (b.status === "OPERATING" ? -1 : -2);
                    break;
                case 'peak':
                    valA = getHighOfDay(a);
                    valB = getHighOfDay(b);
                    break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return rides;
    }, [currentParkData, searchQuery, sortField, sortDirection]);

    const averageWaitTime = useMemo(() => {
        if (filteredRides.length === 0) return 0;
        const operatingRides = filteredRides.filter(r => r.status === "OPERATING" && r.queue?.STANDBY?.waitTime !== undefined);
        if (operatingRides.length === 0) return 0;
        const total = operatingRides.reduce((sum, r) => sum + (r.queue?.STANDBY?.waitTime || 0), 0);
        return Math.round(total / operatingRides.length);
    }, [filteredRides]);

    const busynessLevel = useMemo(() => {
        if (averageWaitTime < 15) return { label: "Quiet", color: "text-green-500" };
        if (averageWaitTime < 35) return { label: "Moderate", color: "text-yellow-500" };
        if (averageWaitTime < 50) return { label: "Busy", color: "text-orange-500" };
        return { label: "Very Busy", color: "text-red-500" };
    }, [averageWaitTime]);

    // Render Cell content based on column ID
    const renderCell = (ride: LiveStatus, colId: string) => {
        if (colId === 'name') {
            return (
                <>
                    {ride.name}
                    {expandedRideId === ride.id && (
                        <div className="mt-4 h-48 w-full md:w-[400px]">
                            <WaitTimeChart rideId={ride.id} ride={ride} history={data?.history || []} />
                        </div>
                    )}
                </>
            );
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

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen text-red-500">
                {error}
            </div>
        );
    }

    if (!data) return <div className="p-8">Loading...</div>;

    return (
        <div className="container mx-auto p-4 max-w-7xl">
            <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Disney Wait Tracker
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Real-time ride availability & historical trends
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-2 rounded-lg shadow-sm border">
                    <div className="text-right px-2">
                        <p className="text-xs text-gray-400 uppercase font-bold">Park Status</p>
                        <p className={cn("text-lg font-bold", busynessLevel.color)}>{busynessLevel.label}</p>
                    </div>
                    <div className="h-8 w-px bg-gray-200 dark:bg-zinc-700" />
                    <div className="text-right px-2">
                        <p className="text-xs text-gray-400 uppercase font-bold">Avg Wait</p>
                        <p className="text-lg font-bold">{averageWaitTime} min</p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-6 dark:bg-zinc-800 max-w-md">
                {Object.entries(PARK_NAMES).map(([id, name]) => (
                    <button
                        key={id}
                        onClick={() => setSelectedParkId(id)}
                        className={cn(
                            "w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all text-center",
                            selectedParkId === id
                                ? "bg-white text-blue-700 shadow dark:bg-zinc-700 dark:text-blue-400"
                                : "text-gray-500 hover:text-gray-700 hover:bg-white/[0.12] dark:text-gray-400"
                        )}
                    >
                        {name.replace("Disney ", "").replace(" Park", "")}
                    </button>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search rides..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none dark:bg-zinc-800 dark:border-zinc-700"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {viewMode === 'list' && (
                        <button
                            onClick={() => setShowHours(!showHours)}
                            className={cn(
                                "px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                                showHours ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300"
                            )}
                        >
                            {showHours ? "Hide Hours" : "Show Hours"}
                        </button>
                    )}

                    <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg flex border dark:border-zinc-700">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2 rounded-md transition-colors",
                                viewMode === 'grid' ? "bg-white shadow-sm dark:bg-zinc-700" : "hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-500"
                            )}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-2 rounded-md transition-colors",
                                viewMode === 'list' ? "bg-white shadow-sm dark:bg-zinc-700" : "hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-500"
                            )}
                            title="List View"
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={refreshData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors h-[42px]"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        {loading ? "Updating..." : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredRides.map((ride) => {
                        const land = getLand(ride.name);
                        const ticket = getTicketClass(ride.name);
                        return (
                            <div
                                key={ride.id}
                                className="group cursor-pointer"
                                onClick={() => setExpandedRideId(expandedRideId === ride.id ? null : ride.id)}
                            >
                                <div className={cn(
                                    "transition-all duration-200",
                                    expandedRideId === ride.id ? "col-span-1 md:col-span-2 row-span-2" : ""
                                )}>
                                    <div className="relative">
                                        <RideCard ride={ride} />
                                        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                            <div className=" text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded border dark:bg-zinc-900 dark:border-zinc-700">
                                                {land}
                                            </div>
                                            {ticket !== '—' && (
                                                <span className={cn(
                                                    "text-[10px] font-bold px-1.5 py-0.5 rounded border shadow-sm uppercase",
                                                    ticket === 'E' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                                        ticket === 'D' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                            "bg-gray-50 text-gray-500"
                                                )}>
                                                    {ticket}-Ticket
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {expandedRideId === ride.id && (
                                        <div className="mt-2 p-4 bg-white dark:bg-zinc-800 border rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-sm font-semibold">Live Wait Time Trend</h4>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3" />
                                                    High of Day: <span className="font-bold text-gray-700 dark:text-gray-300">{getHighOfDay(ride)} min</span>
                                                </div>
                                            </div>
                                            <WaitTimeChart rideId={ride.id} ride={ride} history={data?.history || []} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {filteredRides.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No rides found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border overflow-hidden">
                    <div className="overflow-x-auto">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <table className="w-full text-left text-sm relative">
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
                                    {filteredRides.map((ride) => (
                                        <tr
                                            key={ride.id}
                                            className="group hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
                                            onClick={() => setExpandedRideId(expandedRideId === ride.id ? null : ride.id)}
                                        >
                                            {visibleColumns.map((col, idx) => (
                                                <td
                                                    key={col.id}
                                                    className={cn(
                                                        "px-6 py-4",
                                                        idx === 0 && "sticky left-0 z-10 bg-white group-hover:bg-gray-50 dark:bg-zinc-800 dark:group-hover:bg-zinc-700/50 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] transition-colors",
                                                        col.className
                                                    )}
                                                >
                                                    {renderCell(ride, col.id)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </DndContext>
                    </div>
                    {filteredRides.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No rides found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
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
