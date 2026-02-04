"use client";

import { Ride, WaitTimeSnapshot } from "@/lib/types";
import { RideCard } from "../RideCard";
import { WaitTimeChart } from "../WaitTimeChart";
import { getLand, getTicketClass } from "@/lib/parks";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface RideGridProps {
    rides: Ride[];
    searchQuery: string;
    expandedRideId: string | null;
    setExpandedRideId: (id: string | null) => void;
    history: WaitTimeSnapshot[];
    getHighOfDay: (ride: Ride) => number;
    favorites: string[];
    toggleFavorite: (id: string) => void;
}

export function RideGrid({
    rides,
    searchQuery,
    expandedRideId,
    setExpandedRideId,
    history,
    getHighOfDay,
    favorites,
    toggleFavorite
}: RideGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rides.map((ride) => {
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
                                <RideCard
                                    ride={ride}
                                    isFavorite={favorites.includes(ride.id)}
                                    toggleFavorite={toggleFavorite}
                                />
                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
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
                                    <WaitTimeChart rideId={ride.id} ride={ride} history={history} />
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
            {rides.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                    No rides found matching "{searchQuery}"
                </div>
            )}
        </div>
    );
}
