import { Ride } from "@/lib/types";
import { getLand, getTicketClass } from "@/lib/parks";
import { SortField, SortDirection } from "@/components/dashboard/RideTable";

export function getHighOfDay(ride: Ride) {
    if (!ride.forecast) return 0;
    const today = new Date().toDateString();
    const todayForecasts = ride.forecast.filter(f => new Date(f.time).toDateString() === today);
    if (todayForecasts.length === 0) return 0;
    return Math.max(...todayForecasts.map(f => f.waitTime));
}

export function sortRides(rides: Ride[], sortField: SortField, sortDirection: SortDirection): Ride[] {
    return [...rides].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortField) {
            case 'name':
                valA = a.name;
                valB = b.name;
                break;
            case 'waitTime':
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
                const score = (r: Ride) => {
                    const t = getTicketClass(r.name);
                    // E-Ticket is highest value (5), A is lowest (1)
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
}
