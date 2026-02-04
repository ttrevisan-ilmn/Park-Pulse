import { Ride } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle, Star } from "lucide-react";

interface RideCardProps {
    ride: Ride;
    isFavorite: boolean;
    toggleFavorite: (id: string) => void;
}

export function RideCard({ ride, isFavorite, toggleFavorite }: RideCardProps) {
    const isOperating = ride.status === "OPERATING";
    const waitTime = ride.queue?.STANDBY?.waitTime ?? 0;
    const statusColor = isOperating
        ? waitTime > 60
            ? "text-red-500"
            : waitTime > 30
                ? "text-yellow-500"
                : "text-green-500"
        : "text-gray-400";

    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white dark:bg-zinc-800 dark:border-zinc-700 flex flex-col justify-between h-full relative group/card">
            <div className="flex justify-between items-start gap-2">
                <div>
                    <h3 className="font-semibold text-lg line-clamp-2 pr-6">{ride.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{ride.entityType}</p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(ride.id);
                    }}
                    className={cn(
                        "p-1 rounded-full transition-all focus:outline-none z-10",
                        isFavorite
                            ? "text-yellow-500 hover:text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20"
                            : "text-gray-300 hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 opacity-0 group-hover/card:opacity-100"
                    )}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star className={cn("w-5 h-5", isFavorite && "fill-current")} />
                </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <div className={cn("flex items-center gap-2", statusColor)}>
                    {isOperating ? (
                        <>
                            <Clock className="w-5 h-5" />
                            <span className="font-bold text-xl">{waitTime} min</span>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-medium capitalize">{ride.status.toLowerCase()}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
