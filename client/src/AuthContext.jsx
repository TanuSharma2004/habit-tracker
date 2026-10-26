import { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(api.getStoredUser()); // survives page refresh

  const save = (data) => {
    localStorage.setItem("user", JSON.stringify(data)); // { _id, name, email, token }
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  // api.js fires this event when the server says the token is no longer valid
  useEffect(() => {
    window.addEventListener("auth-expired", logout);
    return () => window.removeEventListener("auth-expired", logout);
  }, []);

  const login = async (credentials) => save(await api.login(credentials));
  const register = async (details) => save(await api.register(details));

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
