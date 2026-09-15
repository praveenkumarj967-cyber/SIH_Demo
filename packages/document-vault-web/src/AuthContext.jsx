import React, { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [citizen, setCitizenState] = useState(() => {
    const raw = sessionStorage.getItem("vault.citizen");
    return raw ? JSON.parse(raw) : null;
  });
  const [official, setOfficialState] = useState(() => {
    const raw = sessionStorage.getItem("vault.official");
    return raw ? JSON.parse(raw) : null;
  });

  const setCitizen = useCallback((value) => {
    setCitizenState(value);
    if (value) sessionStorage.setItem("vault.citizen", JSON.stringify(value));
    else sessionStorage.removeItem("vault.citizen");
  }, []);

  const setOfficial = useCallback((value) => {
    setOfficialState(value);
    if (value) sessionStorage.setItem("vault.official", JSON.stringify(value));
    else sessionStorage.removeItem("vault.official");
  }, []);

  return (
    <AuthContext.Provider value={{ citizen, setCitizen, official, setOfficial }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
