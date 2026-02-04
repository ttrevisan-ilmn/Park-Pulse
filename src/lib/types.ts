export interface LiveQueue {
    STANDBY?: {
        waitTime: number;
    };
    PAID_RETURN_TIME?: {
        state: string;
        returnStart?: string;
        returnEnd?: string;
        price?: {
            amount: number;
            currency: string;
            formatted: string;
        };
    };
    BOARDING_GROUP?: {
        allocationStatus: string;
        estimatedWait?: number;
    };
}

export interface Forecast {
    time: string;
    waitTime: number;
    percentage: number;
}

export interface Queue {
    STANDBY?: {
        waitTime: number;
    };
    PAID_RETURN_TIME?: {
        state: string;
        returnStart?: string;
        returnEnd?: string;
        price?: {
            amount: number;
            currency: string;
        };
    };
    BOARDING_GROUP?: {
        allocationStatus: string;
        currentGroupStart?: string;
        currentGroupEnd?: string;
        nextAllocationTime?: string;
    };
}

export interface OperatingHours {
    type: string;
    startTime: string;
    endTime: string;
}

export interface ShowTime {
    type: string;
    startTime: string;
    endTime: string;
}

export interface Ride {
    id: string;
    name: string;
    entityType: "ATTRACTION" | "SHOW" | "RESTAURANT";
    parkId: string;
    externalId: string;
    status: "OPERATING" | "CLOSED" | "DOWN" | "REFURBISHMENT";
    lastUpdated: string;
    queue?: Queue;
    forecast?: Forecast[];
    operatingHours?: OperatingHours[];
    showtimes?: ShowTime[];
}

export interface ParkLiveData {
    id: string;
    name: string;
    liveData: Ride[];
}

export interface WaitTimeSnapshot {
    timestamp: string;
    parks: ParkLiveData[];
}
