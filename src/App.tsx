import { createContext, useContext, useState, useEffect, Dispatch, SetStateAction } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Admin from './pages/Admin';

interface User {
  id: number;
  uid: string;
  username: string;
  role: string;
  avatar?: string;
  credits: number;
  level: number;
  text_color?: string;
  bubble_style?: string;
}

interface AuthContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  socket: Socket | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    fetch('/api/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      const newSocket = io();
      setSocket(newSocket);
      return () => {
        newSocket.close();
      };
    } else {
      setSocket(null);
    }
  }, [user]);

  if (loading) return <div className="h-screen flex items-center justify-center">جاري التحميل...</div>;

  return (
    <AuthContext.Provider value={{ user, setUser, socket, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="/" element={user ? <Lobby /> : <Navigate to="/login" />} />
          <Route path="/room/:id" element={user ? <Room /> : <Navigate to="/login" />} />
          <Route path="/admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
