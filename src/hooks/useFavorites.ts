"use client";

import { useState, useEffect } from "react";

export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem("disney-parks-favorites");
        if (saved) {
            try {
                setFavorites(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse favorites", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to local storage whenever favorites change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem("disney-parks-favorites", JSON.stringify(favorites));
        }
    }, [favorites, isLoaded]);

    const toggleFavorite = (rideId: string) => {
        setFavorites((prev) => {
            if (prev.includes(rideId)) {
                return prev.filter((id) => id !== rideId);
            } else {
                return [...prev, rideId];
            }
        });
    };

    const isFavorite = (rideId: string) => favorites.includes(rideId);

    return { favorites, toggleFavorite, isFavorite, isLoaded };
}
