import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, Edit2, Mail, Search, Phone, Building } from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import { toast } from "react-toastify";
import Loader from "./Loader";
import { buildApiUrl, parseJsonResponse } from "../api";

export default function CompanyPortal() {
  const { user, userRole, isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [listedByFilter, setListedByFilter] = useState("all");
  const [coordinatorFilter, setCoordinatorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filter, setFilter] = useState("all");
  const [scUsers, setScUsers] = useState([]);

  const profileOptions = useMemo(() => {
    const profiles = new Set();
    companies.forEach((company) => {
      (company.profiles || []).forEach((profile) => {
        const normalized = String(profile || "").trim();
        if (normalized) profiles.add(normalized);
      });
    });
    return ["all", ...Array.from(profiles).sort((a, b) => a.localeCompare(b))];
  }, [companies]);

  const coordinatorMap = useMemo(() => {
    const map = new Map();
    scUsers.forEach((scUser) => {
      const email = (scUser.email || "").toLowerCase();
      if (email) map.set(email, scUser.name || "");
    });
    return map;
  }, [scUsers]);

  const coordinatorOptions = useMemo(() => {
    const emails = new Set();
    scUsers.forEach((scUser) => {
      const email = (scUser.email || "").toLowerCase();
      if (email) emails.add(email);
    });

    companies.forEach((company) => {
      const email = (company.scEmail || "").toLowerCase();
      if (email) emails.add(email);
    });

    return Array.from(emails).sort();
  }, [scUsers, companies]);

  const matchesStatusFilter = useCallback(
    (company) => {
      if (statusFilter === "all") return true;

      const normalizedStatuses = (company.pocs || []).map((poc) =>
        (poc.status || "").toLowerCase()
      );

      return statusFilter === "all" || normalizedStatuses.includes(statusFilter);
    },
    [statusFilter]
  );

  const fetchAllCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl("/api/get-all-companies"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter,
        }),
      });
      const data = await parseJsonResponse(response);
      const message = data?.message;
      const companies = data?.companies || [];

      if (response.status === 401) {
        setCompanies([]);
        return;
      }

      if (response.status !== 200) {
        console.error("Error fetching companies:", message);
        toast.error("Error fetching companies. Please try again later.");
        return;
      }

      setCompanies(Array.isArray(companies) ? companies : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Network request failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const filtered = companies.filter((company) => {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const lowerCaseDprEmail = (company.dprEmail || "").toLowerCase();
      const lowerCaseCompanyName = (company.name || "").toLowerCase();
      const lowerCaseProfiles = (company.profiles || []).map((profile) =>
        (profile || "").toLowerCase()
      );
      const lowerCaseSCEmail = (company.scEmail || "").toLowerCase();
      const lowerCasePocNames = (company.pocs || []).map((poc) => (poc.name || "").toLowerCase());
      const lowerCasePOCEmails = (company.pocs || []).map((poc) => (poc.email || "").toLowerCase());
      const lowerCasePOCStatus = (company.pocs || []).map((poc) => (poc.status || "").toLowerCase());

      const matchesSearch =
        searchQuery === "" ||
        lowerCaseDprEmail.includes(lowerCaseQuery) ||
        lowerCaseCompanyName.includes(lowerCaseQuery) ||
        lowerCaseProfiles.some((profile) => profile.includes(lowerCaseQuery)) ||
        lowerCasePocNames.some((poc) => poc.includes(lowerCaseQuery)) ||
        lowerCasePOCEmails.some((email) => email.includes(lowerCaseQuery)) ||
        lowerCasePOCStatus.some((status) => status.includes(lowerCaseQuery)) ||
        lowerCaseSCEmail.includes(lowerCaseQuery);

      const normalizedUserEmail = (user?.email || "").toLowerCase();

      const matchesProfileFilter =
        profileFilter === "all" || lowerCaseProfiles.includes(profileFilter.toLowerCase());

      const matchesListedByFilter =
        listedByFilter === "all" ||
        (listedByFilter === "listed-by-me" && lowerCaseDprEmail === normalizedUserEmail);

      const matchesCoordinatorFilter =
        coordinatorFilter === "all" ||
        (coordinatorFilter === "assigned-to-me" && lowerCaseSCEmail === normalizedUserEmail) ||
        (coordinatorFilter === "unassigned" && !lowerCaseSCEmail) ||
        lowerCaseSCEmail === coordinatorFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatusFilter(company) &&
        matchesProfileFilter &&
        matchesListedByFilter &&
        matchesCoordinatorFilter
      );
    });

    setFilteredCompanies(filtered);
  }, [searchQuery, companies, profileFilter, listedByFilter, coordinatorFilter, statusFilter, user?.email, matchesStatusFilter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAllCompanies();
  }, [isAuthenticated, filter, user?.email, fetchAllCompanies]);

  const loadScUsers = useCallback(async () => {
    if (userRole !== "admin" && userRole !== "sc") return;

    try {
      const response = await fetch(buildApiUrl("/api/get-sc-users"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await parseJsonResponse(response);
      if (data?.success) {
        setScUsers(data.users || []);
      } else {
        setScUsers([]);
      }
    } catch (error) {
      console.error("Failed to load SC users", error);
      setScUsers([]);
    }
  }, [userRole]);

  useEffect(() => {
    loadScUsers();
  }, [loadScUsers]);

  if (loading) return <Loader loading={loading} />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header - Integrated cleanly into the background */}
        <div className="mb-3 border-b border-slate-200 pb-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Company Listing Portal</h1>
          <p className="mt-1 text-sm text-slate-500">For Placement & Internship Season 2026-27</p>
        </div>

        {/* Filters - Stripped of the outer box */}
        <div className="mb-8 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Global Search</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search company, profile, coordinator, or status..."
                  className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setProfileFilter("all");
                setListedByFilter("all");
                setCoordinatorFilter("all");
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="h-[42px] rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              Clear Filters
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Profile</label>
              <select
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              >
                {profileOptions.map((profileOption) => (
                  <option key={profileOption} value={profileOption}>
                    {profileOption === "all" ? "All profiles" : profileOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Coordinator</label>
              <select
                value={coordinatorFilter}
                onChange={(e) => setCoordinatorFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              >
                <option value="all">All coordinators</option>
                {userRole === "sc" && <option value="assigned-to-me">Assigned to me</option>}
                <option value="unassigned">Unassigned</option>
                {coordinatorOptions.map((email) => (
                  <option key={email} value={email}>
                    {coordinatorMap.get(email) ? `${coordinatorMap.get(email)} (${email})` : email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              >
                <option value="all">All statuses</option>
                <option value="yet to contact">Yet to contact</option>
                <option value="ongoing">Ongoing</option>
                <option value="onboarded">Onboarded</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {userRole === "dpr" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Listed by</label>
                <select
                  value={listedByFilter}
                  onChange={(e) => setListedByFilter(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
                >
                  <option value="all">Listed by anyone</option>
                  <option value="listed-by-me">Listed by me</option>
                </select>
              </div>
            )}

            {userRole === "admin" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Admin view</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
                >
                  <option value="all">All Companies</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Master List Container - No shadows, clean border */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {filteredCompanies.length > 0 ? (
            <div className="flex flex-col divide-y divide-slate-200">
              {filteredCompanies.map((company) => (
                <Company
                  key={company._id}
                  id={company._id}
                  name={company.name}
                  profiles={company.profiles}
                  pocs={company.pocs}
                  currentScEmail={company.scEmail}
                  currentScName={company.scUserName || null}
                  setCompanies={setCompanies}
                  userRole={userRole}
                  scUsers={scUsers}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-slate-50/50">
              <Building size={40} className="mb-4 text-slate-300" />
              <p className="text-base font-medium text-slate-600">No companies found matching your criteria.</p>
              <p className="text-sm text-slate-400 mt-1">Try adjusting or clearing your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Company({ name, profiles, pocs, id, currentScEmail, currentScName, setCompanies, userRole, scUsers }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingProfiles, setIsEditingProfiles] = useState(false);
  const [editableProfiles, setEditableProfiles] = useState(profiles || []);
  const [profileDraft, setProfileDraft] = useState("");
  const [profileEditIndex, setProfileEditIndex] = useState(-1);
  const [profileEditText, setProfileEditText] = useState("");

  const updatePOCStatus = async (pocId, status) => {
    if (userRole !== "admin" && userRole !== "sc") return;
    try {
      const response = await fetch(buildApiUrl("/api/update-poc-status"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: id,
          pocId: pocId,
          status: status,
        }),
      });
      const data = await parseJsonResponse(response);

      if (data.success) {
        toast.success("Status updated");
        setCompanies((prev) =>
          prev.map((prevCompany) =>
            prevCompany._id === id
              ? {
                  ...prevCompany,
                  pocs: prevCompany.pocs.map((prevPOC) =>
                    prevPOC._id === pocId ? { ...prevPOC, status: status } : prevPOC
                  ),
                }
              : prevCompany
          )
        );
      } else {
        toast.error("Something went wrong");
      }
    } catch {
      toast.error("Network request failed");
    }
  };

  const updatePOCRemark = async (pocId, remarks) => {
    if (!['admin', 'sc', 'dpr'].includes(userRole)) return;
    try {
      const response = await fetch(buildApiUrl("/api/update-poc-remarks"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: id,
          pocId: pocId,
          remarks: remarks,
        }),
      });
      const data = await parseJsonResponse(response);

      if (data.success) {
        const updatedCompany = data.company;
        const updatedPOC = updatedCompany?.pocs?.find((poc) => poc._id === pocId);

        toast.success("Remark added");
        setCompanies((prev) =>
          prev.map((prevCompany) =>
            prevCompany._id === id
              ? { ...prevCompany, pocs: updatedCompany?.pocs || prevCompany.pocs }
              : prevCompany
          )
        );

        if (!updatedPOC) {
          return;
        }
      } else {
        toast.error(data?.message || "Something went wrong");
      }
    } catch {
      toast.error("Network request failed");
    }
  };

  const handleAssignSc = async (event) => {
    const selectedScEmail = event.target.value;
    const normalizedScEmail = selectedScEmail ? selectedScEmail.toLowerCase() : "";

    try {
      const response = await fetch(buildApiUrl("/api/assign-sc"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id, scEmail: normalizedScEmail }),
      });
      const data = await parseJsonResponse(response);

      if (response.ok && data?.success) {
        const assignedScUser = scUsers.find((entry) => entry.email?.toLowerCase() === normalizedScEmail);
        toast.success("Coordinator assigned");
        setCompanies((prev) =>
          prev.map((company) =>
            company._id === id
              ? { ...company, scEmail: normalizedScEmail, scUserName: assignedScUser?.name || null }
              : company
          )
        );
      } else {
        toast.error(data?.message || "Failed to assign coordinator");
      }
    } catch {
      toast.error("Failed to assign coordinator");
    }
  };

  const handleDeleteCompany = async () => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      const response = await fetch(buildApiUrl("/api/delete-company"), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: id,
        }),
      });
      const data = await parseJsonResponse(response);

      if (data.success) {
        toast.success("Company deleted");
        setCompanies((prev) => prev.filter((c) => c._id !== id));
      } else {
        toast.error(data.message || "Failed to delete company");
      }
    } catch {
      toast.error("Network request failed");
    }
  };

  useEffect(() => {
    setEditableProfiles(profiles || []);
    if (!isEditingProfiles) {
      setProfileDraft("");
      setProfileEditIndex(-1);
      setProfileEditText("");
    }
  }, [profiles, isEditingProfiles]);

  const addProfile = () => {
    const trimmed = profileDraft.trim();
    if (!trimmed) {
      toast.error("Profile cannot be empty"); return;
    }
    if (editableProfiles.some((profile) => profile.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Profile already exists"); return;
    }
    setEditableProfiles((prev) => [...prev, trimmed]);
    setProfileDraft("");
  };

  const removeProfile = (index) => {
    const nextProfiles = editableProfiles.filter((_, i) => i !== index);
    if (nextProfiles.length === 0) {
      toast.error("At least one profile required"); return;
    }
    setEditableProfiles(nextProfiles);
  };

  const startEditProfile = (index) => {
    setProfileEditIndex(index);
    setProfileEditText(editableProfiles[index] || "");
  };

  const saveProfileEdit = () => {
    const trimmed = profileEditText.trim();
    if (!trimmed) { toast.error("Profile cannot be empty"); return; }
    if (editableProfiles.some((profile, index) => index !== profileEditIndex && profile.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Profile already exists"); return;
    }
    setEditableProfiles((prev) =>
      prev.map((profile, index) => (index === profileEditIndex ? trimmed : profile))
    );
    setProfileEditIndex(-1);
    setProfileEditText("");
  };

  const cancelProfileEdit = () => {
    setProfileEditIndex(-1);
    setProfileEditText("");
  };

  const saveProfileChanges = async () => {
    if (editableProfiles.length === 0) {
      toast.error("At least one profile required"); return;
    }
    try {
      const response = await fetch(buildApiUrl("/api/update-company-profiles"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: id,
          profiles: editableProfiles,
        }),
      });
      const data = await parseJsonResponse(response);

      if (response.ok && data?.success) {
        toast.success("Profiles updated");
        setIsEditingProfiles(false);
        setCompanies((prev) =>
          prev.map((company) =>
            company._id === id ? { ...company, profiles: editableProfiles } : company
          )
        );
      } else {
        toast.error(data?.message || "Failed to update profiles");
      }
    } catch {
      toast.error("Network request failed");
    }
  };

  return (
    <div className="group transition-colors duration-200">
      <div 
        className={`flex cursor-pointer items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors ${isOpen ? "bg-slate-50 border-b border-slate-200" : "bg-white"}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900 truncate">{name}</h3>
            {profiles?.length > 0 && (
              <span className="hidden sm:inline-flex items-center rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                {profiles.length} profile{profiles.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 truncate font-medium">{profiles?.join(" • ") || "No profiles listed"}</p>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <div className="hidden text-right md:block">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Coordinator</div>
            <div className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">
              {currentScName || currentScEmail || <span className="text-slate-400 italic font-normal">Unassigned</span>}
            </div>
          </div>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 transition-all duration-300 ${isOpen ? "rotate-180 bg-blue-600 text-white border-blue-600" : "group-hover:border-slate-300 group-hover:text-slate-600"}`}>
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="bg-slate-50/50 px-6 py-6">
          {(userRole === "admin" || userRole === "sc") && (
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-white p-4 border border-slate-200">
              <div>
                <div className="text-sm font-bold text-slate-800">Coordinator Assignment</div>
                {/* <div className="text-xs text-slate-500 mt-0.5">Update the primary coordinator for this company</div> */}
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={currentScEmail || ""}
                  onChange={handleAssignSc}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 font-medium focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Unassigned</option>
                  {scUsers.map((scUser) => (
                    <option key={scUser.email} value={scUser.email}>
                      {scUser.name} ({scUser.email})
                    </option>
                  ))}
                </select>
                {userRole === "admin" && (
                  <button onClick={handleDeleteCompany} className="rounded-md bg-white border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors">
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-1 bg-white p-5 rounded-lg border border-slate-200 self-start">
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Profiles Offered</h4>
              <div className="flex flex-col gap-2">
                {profiles.map((profile, index) => (
                  <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700" key={index}>
                    {profile}
                  </div>
                ))}
              </div>

              {(userRole === "admin" || userRole === "sc") && (
                <div className="mt-5 pt-5 border-t border-slate-100">
                  {isEditingProfiles ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {editableProfiles.length > 0 ? (
                          editableProfiles.map((profile, index) => (
                            <div key={index} className="flex items-center gap-2">
                              {profileEditIndex === index ? (
                                <>
                                  <input
                                    value={profileEditText}
                                    onChange={(e) => setProfileEditText(e.target.value)}
                                    className="h-8 min-w-0 flex-1 rounded-md border border-blue-300 bg-blue-50 px-2 text-sm font-medium focus:border-blue-600 focus:outline-none"
                                  />
                                  <button onClick={saveProfileEdit} className="text-sm font-bold text-blue-600 hover:text-blue-700">Save</button>
                                  <button onClick={cancelProfileEdit} className="text-sm font-medium text-slate-500 hover:text-slate-700">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1 truncate text-sm font-medium text-slate-700">{profile}</span>
                                  <button onClick={() => startEditProfile(index)} className="text-slate-400 hover:text-blue-600 p-1"><Edit2 size={14} /></button>
                                  <button onClick={() => removeProfile(index)} className="text-slate-400 hover:text-red-600 p-1 font-bold text-lg leading-none">&times;</button>
                                </>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm italic text-slate-400">None</div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                        <input
                          value={profileDraft}
                          onChange={(e) => setProfileDraft(e.target.value)}
                          placeholder="Type new profile..."
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-blue-600 focus:outline-none"
                        />
                        <button onClick={addProfile} className="w-full rounded-md bg-slate-800 py-2 text-sm font-semibold text-white hover:bg-slate-900 transition-colors">Add Profile</button>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button onClick={saveProfileChanges} className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Save All</button>
                        <button onClick={() => setIsEditingProfiles(false)} className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditingProfiles(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                      <Edit2 size={14} /> Edit Profiles
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-3">
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Points of Contact ({pocs.length})</h4>
              <div className="grid gap-4">
                {pocs.map((poc, index) => {
                  const displayPOC = userRole === "dpr"
                    ? { ...poc, name: `HR${index + 1}`, email: `hr${index + 1}@example.com`, phone: 'XXXXXXX' }
                    : poc;

                  return (
                    <POC
                      key={poc._id || index}
                      name={displayPOC.name}
                      email={displayPOC.email}
                      phone={displayPOC.phone}
                      status={displayPOC.status}
                      remarks={displayPOC.remarks}
                      updateStatus={updatePOCStatus}
                      updateRemarks={updatePOCRemark}
                      id={poc._id}
                      userRole={userRole}
                      currentUserName={user?.name}
                      currentUserEmail={user?.email}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeRemarks(remarksValue) {
  if (Array.isArray(remarksValue)) {
    return remarksValue.filter((remark) => remark && (remark.text || remark.message || remark.remarks));
  }

  if (typeof remarksValue === "string" && remarksValue.trim()) {
    return [{
      role: "dpr",
      author: "Previous note",
      authorEmail: "",
      text: remarksValue.trim(),
      createdAt: new Date().toISOString(),
    }];
  }

  return [];
}

function POC({ name, email, phone, status, remarks, updateRemarks, updateStatus, id, userRole, currentUserName, currentUserEmail }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRemark, setEditedRemark] = useState("");
  const normalizedRemarks = useMemo(() => normalizeRemarks(remarks), [remarks]);

  const handleSave = () => {
    const trimmed = editedRemark.trim();
    if (!trimmed) return;

    updateRemarks(id, trimmed);
    setEditedRemark("");
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedRemark("");
    setIsEditing(false);
  };

  const statusColors = {
    "yet to contact": "bg-slate-100 text-slate-700 border-slate-200",
    "ongoing": "bg-blue-50 text-blue-700 border-blue-200",
    "onboarded": "bg-teal-50 text-teal-700 border-teal-200",
    "rejected": "bg-red-50 text-red-700 border-red-200"
  };

  return (
    <div className="flex flex-col bg-white p-5 rounded-lg border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
        <div className="space-y-2 flex-1">
          <div className="text-base font-bold text-slate-900">{name}</div>
          {(userRole === 'admin' || userRole === 'sc') && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
              <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors w-fit">
                <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200"><Mail size={14} className="text-slate-500" /></div>
                <span>{email}</span>
              </a>
              <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors w-fit">
                <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200"><Phone size={14} className="text-slate-500" /></div>
                <span>{phone}</span>
              </a>
            </div>
          )}
        </div>

        <div className="w-full sm:w-48 shrink-0">
          <select
            value={status}
            className={`w-full rounded-md border px-3 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors ${statusColors[status] || statusColors["yet to contact"]}`}
            onChange={(e) => updateStatus(id, e.target.value)}
            disabled={userRole !== "admin" && userRole !== "sc"}
          >
            <option value="yet to contact">Yet to contact</option>
            <option value="ongoing">Ongoing</option>
            <option value="onboarded">Onboarded</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Remarks</span>
          {['admin', 'sc', 'dpr'].includes(userRole) && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition-all hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50"
            >
              <Edit2 size={12} /> Add remark
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editedRemark}
              onChange={(e) => setEditedRemark(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-medium text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 min-h-[80px]"
              placeholder={`Add a ${userRole === 'sc' ? 'SC' : userRole === 'dpr' ? 'DPR' : 'admin'} remark...`}
            />
            <div className="flex gap-3">
              <button onClick={handleSave} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Save remark</button>
              <button onClick={handleCancel} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {normalizedRemarks.length > 0 ? (
            normalizedRemarks.map((remark, index) => {
              const remarkText = remark.text || remark.message || remark.remarks || "";
              const roleLabel = remark.role === "sc" ? "SC" : remark.role === "dpr" ? "DPR" : remark.role === "admin" ? "Admin" : "Note";
              const author = remark.author || remark.authorEmail || currentUserName || currentUserEmail || "Unknown user";

              return (
                <div key={`${remarkText}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{roleLabel}</span>
                    <span className="text-[11px] text-slate-400">{author}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {remarkText || <span className="text-slate-400 italic">No remarks added yet.</span>}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm font-medium text-slate-500">No remarks added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}