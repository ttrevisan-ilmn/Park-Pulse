"use client";

import { useEffect, useState, useMemo } from "react";
import { getWaitTimes } from "@/lib/data-service";
import { WaitTimeSnapshot, Ride } from "@/lib/types";
import { PARKS, PARK_NAMES, getTicketClass, getLand } from "@/lib/parks";
import { StatsHeader } from "./dashboard/StatsHeader";
import { HeaderToolbar } from "./dashboard/HeaderToolbar";
import { RideGrid } from "./dashboard/RideGrid";
import { RideTable, SortField, SortDirection } from "./dashboard/RideTable";
import { useFavorites } from "@/hooks/useFavorites";
import { Skeleton } from "@/components/ui/Skeleton";

const REFRESH_INTERVAL = 60 * 1000; // 1 minute
const TARGET_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export function Dashboard() {
    const [data, setData] = useState<{ current: WaitTimeSnapshot; history: WaitTimeSnapshot[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedParkId, setSelectedParkId] = useState(PARKS.DISNEYLAND_PARK);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [expandedRideId, setExpandedRideId] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>('favorite'); // Default to favorite sorting? Or stick to name/ticket?
    // Actually, let's keep name default but allow favorite sort.
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc'); // Favs at top
    const [showHours, setShowHours] = useState(false);

    const { favorites, toggleFavorite } = useFavorites();

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await getWaitTimes();
            setData(result);
        } catch (error) {
            console.error("Failed to fetch wait times:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    const currentPark = data?.current.parks.find((p) => p.id === selectedParkId);

    const rides = useMemo(() => {
        if (!currentPark) return [];

        let filtered = currentPark.liveData.filter(
            (ride) =>
                ride.entityType === "ATTRACTION" &&
                ride.status !== "REFURBISHMENT" &&
                ride.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return filtered.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortField) {
                case 'favorite':
                    valA = favorites.includes(a.id) ? 1 : 0;
                    valB = favorites.includes(b.id) ? 1 : 0;
                    break;
                case 'name':
                    valA = a.name;
                    valB = b.name;
                    break;
                case 'waitTime':
                    // Treat closed/down as -1 so they go to bottom in desc sort, top in asc?
                    // Usually we want highest wait times at top.
                    valA = a.status === 'OPERATING' ? (a.queue?.STANDBY?.waitTime ?? 0) : -1;
                    valB = b.status === 'OPERATING' ? (b.queue?.STANDBY?.waitTime ?? 0) : -1;
                    break;
                case 'land':
                    valA = getLand(a.name);
                    valB = getLand(b.name);
                    break;
                case 'status':
                    valA = a.status;
                    valB = b.status;
                    break;
                case 'ticket':
                    // E < D < C. We want E to be "larger" or "smaller"?
                    // Let's map E=5, D=4, C=3, B=2, A=1, -=0
                    const score = (r: Ride) => {
                        const t = getTicketClass(r.name);
                        const map: Record<string, number> = { 'E': 5, 'D': 4, 'C': 3, 'B': 2, 'A': 1 };
                        return map[t] || 0;
                    };
                    valA = score(a);
                    valB = score(b);
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

    }, [currentPark, searchQuery, sortField, sortDirection, favorites]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // Default to desc for new columns (usually better for numbers/importance)
        }
    };

    const getHighOfDay = (ride: Ride) => {
        if (!ride.forecast) return 0;
        const today = new Date().toDateString();
        const todayForecasts = ride.forecast.filter(f => new Date(f.time).toDateString() === today);
        if (todayForecasts.length === 0) return 0;
        return Math.max(...todayForecasts.map(f => f.waitTime));
    };

    const averageWaitTime = useMemo(() => {
        if (!rides.length) return 0;
        const operatingRides = rides.filter((r) => r.status === "OPERATING");
        if (!operatingRides.length) return 0;
        const totalWait = operatingRides.reduce(
            (acc, ride) => acc + (ride.queue?.STANDBY?.waitTime || 0),
            0
        );
        return Math.round(totalWait / operatingRides.length);
    }, [rides]);

    const busynessLevel = useMemo(() => {
        if (averageWaitTime < 15) return { label: "Quiet", color: "text-green-500" };
        if (averageWaitTime < 30) return { label: "Moderate", color: "text-yellow-500" };
        if (averageWaitTime < 50) return { label: "Busy", color: "text-orange-500" };
        return { label: "Very Busy", color: "text-red-600" };
    }, [averageWaitTime]);


    if (loading && !data) {
        return (
            <main className="min-h-screen bg-white dark:bg-black p-4 md:p-8 font-sans">
                <div className="max-w-7xl mx-auto">
                    {/* Header Skeleton */}
                    <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <Skeleton className="h-10 w-64 mb-2" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-12 w-48 rounded-lg" />
                    </div>

                    {/* Toolbar Skeleton */}
                    <div className="mb-6">
                        <Skeleton className="h-10 w-full max-w-md rounded-xl mb-6" />
                        <div className="flex flex-col sm:flex-row gap-4 justify-between">
                            <Skeleton className="h-10 w-64" />
                            <div className="flex gap-2">
                                <Skeleton className="h-10 w-24" />
                                <Skeleton className="h-10 w-24" />
                            </div>
                        </div>
                    </div>

                    {/* Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-32 w-full rounded-lg" />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white dark:bg-black p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <StatsHeader
                    averageWaitTime={averageWaitTime}
                    busynessLevel={busynessLevel}
                />

                <HeaderToolbar
                    selectedParkId={selectedParkId}
                    setSelectedParkId={setSelectedParkId}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    showHours={showHours}
                    setShowHours={setShowHours}
                    loading={loading}
                    refreshData={fetchData}
                />

                {viewMode === 'grid' ? (
                    <RideGrid
                        rides={rides}
                        searchQuery={searchQuery}
                        expandedRideId={expandedRideId}
                        setExpandedRideId={setExpandedRideId}
                        history={data?.history || []}
                        getHighOfDay={getHighOfDay}
                        favorites={favorites}
                        toggleFavorite={toggleFavorite}
                    />
                ) : (
                    <RideTable
                        rides={rides}
                        searchQuery={searchQuery}
                        expandedRideId={expandedRideId}
                        setExpandedRideId={setExpandedRideId}
                        history={data?.history || []}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        handleSort={handleSort}
                        getHighOfDay={getHighOfDay}
                        showHours={showHours}
                        TARGET_HOURS={TARGET_HOURS}
                        favorites={favorites}
                        toggleFavorite={toggleFavorite}
                    />
                )}
            </div>
        </main>
    );
}
