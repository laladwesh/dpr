import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthProvider";
import { buildApiUrl, parseJsonResponse } from "../api";
import { Plus, Trash2, X, Building, ChevronDown, ChevronUp, Search } from "lucide-react";

const CompanyForm = () => {
  const { userRole } = useAuth();
  const [companies, setCompanies] = useState([
    {
      name: "",
      profiles: [""],
      pocs: [{ name: "", email: "", phone: "", remarks: "" }],
    },
  ]);
  const [suggestions, setSuggestions] = useState({});
  const [expandedSuggestion, setExpandedSuggestion] = useState(null);

  useEffect(() => {
    const timers = companies.map((company, index) => {
      const query = company.name.trim();
      if (query.length < 2) {
        setSuggestions((current) => ({ ...current, [index]: [] }));
        return null;
      }

      return setTimeout(async () => {
        try {
          const response = await fetch(
            `${buildApiUrl("/api/company-suggestions")}?q=${encodeURIComponent(query)}`,
            { credentials: "include" }
          );
          const data = await parseJsonResponse(response);
          if (response.ok) {
            setSuggestions((current) => ({ ...current, [index]: data?.companies || [] }));
          }
        } catch (error) {
          console.error("Error searching companies:", error);
        }
      }, 300);
    });

    return () => timers.forEach((timer) => timer && clearTimeout(timer));
  }, [companies]);

  const handleCompanyChange = (index, field, value) => {
    const updated = [...companies];
    updated[index][field] = value;
    setCompanies(updated);
  };

  const handleProfileChange = (cIndex, rIndex, value) => {
    const updated = [...companies];
    updated[cIndex].profiles[rIndex] = value;
    setCompanies(updated);
  };

  const addProfile = (cIndex) => {
    const updated = [...companies];
    updated[cIndex].profiles.push("");
    setCompanies(updated);
  };

  const removeProfile = (cIndex, rIndex) => {
    const updated = [...companies];
    if (updated[cIndex].profiles.length > 1) {
      updated[cIndex].profiles.splice(rIndex, 1);
      setCompanies(updated);
    }
  };

  const handlePOCChange = (cIndex, hIndex, field, value) => {
    const updated = [...companies];
    updated[cIndex].pocs[hIndex][field] = value;
    setCompanies(updated);
  };

  const addPOC = (cIndex) => {
    const updated = [...companies];
    updated[cIndex].pocs.push({ name: "", email: "", phone: "", remarks: "" });
    setCompanies(updated);
  };

  const removePOC = (cIndex, hIndex) => {
    const updated = [...companies];
    if (updated[cIndex].pocs.length > 1) {
      updated[cIndex].pocs.splice(hIndex, 1);
      setCompanies(updated);
    }
  };

  const addCompany = () => {
    setCompanies([
      ...companies,
      { name: "", profiles: [""], pocs: [{ name: "", email: "", phone: "", remarks: "" }] },
    ]);
  };

  const removeCompany = (index) => {
    if (companies.length > 1) {
      const updated = [...companies];
      updated.splice(index, 1);
      setCompanies(updated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (userRole === "sc") {
      toast.error("Coordinators cannot add companies.");
      return;
    }

    try {
      const response = await fetch(buildApiUrl("/api/add-companies"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companies: companies,
        }),
      });

      const data = await parseJsonResponse(response);
      if (response.ok) {
        toast.success("Form submitted successfully!");
        setCompanies([
          {
            name: "",
            profiles: [""],
            pocs: [{ name: "", email: "", phone: "", remarks: "" }],
          },
        ]);
      } else {
        toast.error(data?.message || data?.error || "Failed to submit form.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Error submitting form. Please try again.");
    }
  };

  return (
    <div className="w-full font-sans text-slate-800 pb-12 pt-2">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-4">
        
        {/* Header - Margins reduced to pull it closer to the toggle buttons above */}
        <div className="border-b border-slate-200 pb-4 mb-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Add Companies</h1>
          <p className="mt-1 text-sm text-slate-500">Fill in the details below to list new companies in the portal.</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {companies.map((company, cIndex) => (
            <div
              key={cIndex}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              <div className="p-6 sm:p-8">
                
                {/* Company Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Building size={20} className="text-slate-400" />
                    <h2 className="text-lg font-bold">Company {cIndex + 1}</h2>
                  </div>
                  {companies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCompany(cIndex)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>

                {/* Company Name */}
                <div className="mb-8">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Company Name
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={company.name}
                      onChange={(e) => handleCompanyChange(cIndex, "name", e.target.value)}
                      required
                      className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800 transition-colors"
                    />
                    {suggestions[cIndex]?.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                        <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                          Similar companies already listed
                        </p>
                        {suggestions[cIndex].map((suggestion) => {
                          const suggestionKey = `${cIndex}-${suggestion.id}`;
                          const isExpanded = expandedSuggestion === suggestionKey;
                          return (
                            <div key={suggestion.id} className="border-b border-slate-100 last:border-0">
                              <button
                                type="button"
                                onClick={() => setExpandedSuggestion(isExpanded ? null : suggestionKey)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                              >
                                <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{suggestion.name}</span>
                                <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-amber-700">
                                  Already added {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </span>
                              </button>
                              {isExpanded && (
                                <div className="bg-slate-50 px-3 pb-3 text-xs text-slate-600">
                                  <p><strong>Listed by:</strong> {suggestion.listedBy}</p>
                                  <p className="mt-1"><strong>Profiles:</strong> {suggestion.profiles.length ? suggestion.profiles.join(", ") : "None"}</p>
                                  <p className="mt-1"><strong>Contacts:</strong> {suggestion.pocs.length || "None"}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Profiles Section */}
                <div className="mb-8">
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Profiles Offered
                    </label>
                    <button
                      type="button"
                      onClick={() => addProfile(cIndex)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-900 transition-colors"
                    >
                      <Plus size={14} /> Add Profile
                    </button>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    {company.profiles.map((profile, rIndex) => (
                      <div 
                        key={rIndex} 
                        className="flex items-center group rounded-md border border-slate-200 bg-slate-50 focus-within:border-blue-800 focus-within:bg-white transition-colors"
                      >
                        <input
                          type="text"
                          placeholder="e.g. Software Engineer"
                          value={profile}
                          onChange={(e) => handleProfileChange(cIndex, rIndex, e.target.value)}
                          required
                          className="flex-1 w-full bg-transparent px-3 py-2 text-sm text-slate-900 focus:outline-none placeholder-slate-400"
                        />
                        {company.profiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProfile(cIndex, rIndex)}
                            className="px-2 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remove profile"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* POC Contacts Section */}
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Points of Contact
                    </label>
                    <button
                      type="button"
                      onClick={() => addPOC(cIndex)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-900 transition-colors"
                    >
                      <Plus size={14} /> Add POC
                    </button>
                  </div>

                  <div className="space-y-4">
                    {company.pocs.map((POC, hIndex) => (
                      <div
                        key={hIndex}
                        className="relative rounded-lg border border-slate-200 bg-slate-50 p-5 pt-6 transition-colors"
                      >
                        {company.pocs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePOC(cIndex, hIndex)}
                            className="absolute top-3 right-3 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remove contact"
                          >
                            <X size={16} />
                          </button>
                        )}
                        
                        <div className="flex flex-col gap-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Name
                              </label>
                              <input
                                type="text"
                                placeholder="Full name"
                                value={POC.name}
                                onChange={(e) => handlePOCChange(cIndex, hIndex, "name", e.target.value)}
                                required
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Email
                              </label>
                              <input
                                type="email"
                                placeholder="name@company.com"
                                value={POC.email}
                                onChange={(e) => handlePOCChange(cIndex, hIndex, "email", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Phone
                              </label>
                              <input
                                type="text"
                                placeholder="+1 (555) 000-0000"
                                value={POC.phone}
                                onChange={(e) => handlePOCChange(cIndex, hIndex, "phone", e.target.value)}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800 transition-colors"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                              Remarks
                            </label>
                            <textarea
                              placeholder="Add any additional notes about this contact..."
                              value={POC.remarks}
                              onChange={(e) => handlePOCChange(cIndex, hIndex, "remarks", e.target.value)}
                              rows="2"
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-800 transition-colors resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
              </div>
            </div>
          ))}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={addCompany}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 transition-colors"
            >
              <Plus size={16} />
              Add Another Company
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-[#192aac] px-8 py-2.5 text-sm font-semibold text-white hover:from-slate-800 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 transition-all"
            >
              Submit Companies
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyForm;