import React, { useState, useEffect } from "react";
import { PenLine, UploadCloud } from "lucide-react";
import FileUpload from "./Components/FileUpload";
import CompanyForm from "./Components/CompanyForm";
import { useNavigate } from "react-router-dom";
import Navbar from "./Components/Navbar";
import Loader from "./Components/Loader";
import { useAuth } from "./context/AuthProvider";

const TABS = [
  { id: "manual", label: "Enter manually", icon: PenLine },
  { id: "file", label: "Upload a file", icon: UploadCloud },
];

const App = () => {
  const [mode, setMode] = useState("manual");
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return <Loader loading={loading} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Companies</h1>
          <p className="mt-1 text-sm text-slate-500">
            List a company by hand, or upload a spreadsheet to add several at once.
          </p>
        </div>

        <div
          role="tablist"
          className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1"
        >
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === tab.id
                    ? "bg-[#192aac] text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <TabIcon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Both forms stay mounted so switching tabs never discards what you've
            typed - only the CSS display changes, not the component tree. */}
        <div className={mode === "manual" ? "block" : "hidden"}>
          <CompanyForm />
        </div>
        <div className={mode === "file" ? "block" : "hidden"}>
          <FileUpload />
        </div>
      </div>
    </div>
  );
};

export default App;
