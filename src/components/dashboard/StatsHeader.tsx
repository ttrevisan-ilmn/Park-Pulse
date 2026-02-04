"use client";

import { cn } from "@/lib/utils";

interface StatsHeaderProps {
    averageWaitTime: number;
    busynessLevel: { label: string; color: string };
}

export function StatsHeader({ averageWaitTime, busynessLevel }: StatsHeaderProps) {
    return (
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
    );
}
