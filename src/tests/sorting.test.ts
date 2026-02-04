import { describe, it, expect } from 'vitest';
import { sortRides } from '@/lib/sorting';
import { Ride } from '@/lib/types';

// Mock Data
const rideA: Ride = { id: '1', name: 'Alice', entityType: 'ATTRACTION', parkId: '1', externalId: '1', status: 'OPERATING', lastUpdated: '', queue: { STANDBY: { waitTime: 10 } } };
const rideB: Ride = { id: '2', name: 'Bob', entityType: 'ATTRACTION', parkId: '1', externalId: '2', status: 'OPERATING', lastUpdated: '', queue: { STANDBY: { waitTime: 30 } } };
const rideClosed: Ride = { id: '3', name: 'Charlie', entityType: 'ATTRACTION', parkId: '1', externalId: '3', status: 'CLOSED', lastUpdated: '' };

describe('sortRides', () => {
    it('sorts by name ascending', () => {
        const sorted = sortRides([rideB, rideA], 'name', 'asc');
        expect(sorted[0].name).toBe('Alice');
        expect(sorted[1].name).toBe('Bob');
    });

    it('sorts by name descending', () => {
        const sorted = sortRides([rideA, rideB], 'name', 'desc');
        expect(sorted[0].name).toBe('Bob');
        expect(sorted[1].name).toBe('Alice');
    });

    it('sorts by waitTime ascending (Closed rides at bottom? logic check)', () => {
        // Current logic: Closed rides get -1 wait time.
        // Ascending sort (-1, 10, 30) -> Closed, 10, 30
        const sorted = sortRides([rideB, rideClosed, rideA], 'waitTime', 'asc');
        expect(sorted[0].name).toBe('Charlie'); // Closed (-1)
        expect(sorted[1].name).toBe('Alice');   // 10
        expect(sorted[2].name).toBe('Bob');     // 30
    });

    it('sorts by waitTime descending', () => {
        // Descending sort (30, 10, -1) -> 30, 10, Closed
        const sorted = sortRides([rideA, rideClosed, rideB], 'waitTime', 'desc');
        expect(sorted[0].name).toBe('Bob');     // 30
        expect(sorted[1].name).toBe('Alice');   // 10
        expect(sorted[2].name).toBe('Charlie'); // Closed
    });
});
