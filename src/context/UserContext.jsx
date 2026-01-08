import React, { createContext, useState, useEffect, useContext } from 'react';
import { checkAuth } from '../services/openalgo';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, false = not auth, true = auth
    const [user, setUser] = useState(null); // Placeholder for user details

    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const isAuth = await checkAuth();
                setIsAuthenticated(isAuth);
            } catch (error) {
                console.error("Auth check failed:", error);
                setIsAuthenticated(false);
            }
        };
        verifyAuth();
    }, []);

    return (
        <UserContext.Provider value={{ isAuthenticated, setIsAuthenticated, user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
