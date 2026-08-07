import React, { useState } from "react";
import { useAuth } from "./context/AuthProvider";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    const res = await login(email, password);

    if (res.success) {
      navigate("/dashboard");
    } else {
      toast.error(res.message || "Invalid credentials");
    }
  };

  return (
    <div
      className="w-full h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url('${import.meta.env.BASE_URL}images/login-bg.jpg')` }}
    >
      <div className="w-96 p-8 bg-white/95 shadow-lg rounded-xl text-center font-sans">
        <img
          src={`${import.meta.env.BASE_URL}images/iitg-logo.png`}
          alt="IITG Logo"
          className="w-20 h-20 mx-auto mb-3"
        />

        <h2 className="text-black font-semibold text-xl mb-5 select-none">
          Company Listing Portal
        </h2>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 text-base font-semibold text-white bg-[#003366] hover:bg-[#002244] rounded-md transition cursor-pointer"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
