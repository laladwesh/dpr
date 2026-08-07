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

  // function to fetch all the companies from api
  const fetchAllCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(buildApiUrl("/api/get-all-companies"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email || "developer@local",
          filter,
        }),
      });
      const data = await parseJsonResponse(response);
      const message = data?.message;
      const companies = data?.companies || [];

      if (response.status !== 200) {
        console.error("Error fetching companies:", message);
        toast.error("Error fetching companies. Please try again later.");
        return;
      }
      if (companies.length === 0) {
        console.log("No companies found for this user.");
        return;
      }
      if (companies.length > 0) {
        console.log("Companies fetched successfully.");
        setCompanies(companies);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Network request failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [filter, user?.email]);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email || "developer@local" }),
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
  }, [user?.email, userRole]);

  useEffect(() => {
    loadScUsers();
  }, [loadScUsers]);

  if (loading) return <Loader loading={loading} />;

  return (
    <div className="mx-auto px-4 py-8 bg-slate-100">
      <div className="mb-6 rounded-[32px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">Company Portal</h1>
            <p className="max-w-2xl text-sm text-slate-600">Welcome back, {user?.name || "there"}. Use the portal to filter companies, manage assignment, and track follow-ups.</p>
          </div>
          <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {filteredCompanies.length} compan{filteredCompanies.length === 1 ? "y" : "ies"} shown
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr] items-end">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">Search companies</div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                name="query"
                placeholder="Search by company, coordinator, profile, or status"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Current results</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{filteredCompanies.length}</div>
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
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile</div>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {profileOptions.map((profileOption) => (
                <option key={profileOption} value={profileOption} className="text-slate-900">
                  {profileOption === "all" ? "All profiles" : profileOption}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Coordinator</div>
            <select
              value={coordinatorFilter}
              onChange={(e) => setCoordinatorFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all" className="text-slate-900">All coordinators</option>
              {userRole === "sc" && (
                <option value="assigned-to-me" className="text-slate-900">Assigned to me</option>
              )}
              <option value="unassigned" className="text-slate-900">Unassigned</option>
              {coordinatorOptions.map((email) => (
                <option key={email} value={email} className="text-slate-900">
                  {coordinatorMap.get(email) ? `${coordinatorMap.get(email)} (${email})` : email}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all" className="text-slate-900">All statuses</option>
              <option value="yet to contact" className="text-slate-900">Yet to contact</option>
              <option value="ongoing" className="text-slate-900">Ongoing</option>
              <option value="onboarded" className="text-slate-900">Onboarded</option>
              <option value="rejected" className="text-slate-900">Rejected</option>
            </select>
          </div>

          {userRole === "dpr" && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Listed by</div>
              <select
                value={listedByFilter}
                onChange={(e) => setListedByFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all" className="text-slate-900">Listed by anyone</option>
                <option value="listed-by-me" className="text-slate-900">Listed by me</option>
              </select>
            </div>
          )}

          {userRole === "admin" && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin view</div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all" className="text-slate-900">All Companies</option>
                <option value="unassigned" className="text-slate-900">Unassigned</option>
                <option value="assigned" className="text-slate-900">Assigned</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 flex flex-col space-y-4 w-full">
        {filteredCompanies.length > 0 ? (
          filteredCompanies.map((company) => (
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
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 rounded-2xl border border-dashed border-gray-200 bg-white">
            <Building size={48} />
            <p className="mt-4">No companies found. Try adjusting your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}


function Company({ name, profiles, pocs, id, currentScEmail, currentScName, setCompanies, userRole, scUsers }) {
  const { user } = useAuth();

  const updatePOCStatus = async (pocId, status) => {
    if (userRole !== "admin" && userRole !== "sc") return;
    try {
      const response = await fetch(buildApiUrl("/api/update-poc-status"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email || "developer@local",
          companyId: id,
          pocId: pocId,
          status: status,
        }),
      });
      const data = await parseJsonResponse(response);

      if (data.success) {
        toast.success("Status updated successfully");

        setCompanies((prev) => {
          return prev.map((prevCompany) => {
            if (prevCompany._id === id) {
              const updatedPOCs = prevCompany.pocs.map((prevPOC) => {
                if (prevPOC._id === pocId) {
                  return {
                    ...prevPOC,
                    status: status,
                  };
                }
                return prevPOC;
              });

              return {
                ...prevCompany,
                pocs: updatedPOCs,
              };
            } else {
              return prevCompany;
            }
          });
        });
      } else {
        toast.error("Something went wrong");
      }
    } catch (error) {
      console.log("error", error);
      toast.error("Network request failed");
    }
  };

  const updatePOCRemark = async (pocId, remarks) => {
    if (userRole !== "admin" && userRole !== "sc") return;
    try {
      const response = await fetch(buildApiUrl("/api/update-poc-remarks"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email || "developer@local",
          companyId: id,
          pocId: pocId,
          remarks: remarks,
        }),
      });
      const data = await parseJsonResponse(response);

      if (data.success) {
        toast.success("Remarks updated successfully");

        setCompanies((prev) => {
          return prev.map((prevCompany) => {
            if (prevCompany._id === id) {
              const updatedPOCs = prevCompany.pocs.map((prevPOC) => {
                if (prevPOC._id === pocId) {
                  return {
                    ...prevPOC,
                    remarks: remarks,
                  };
                }
                return prevPOC;
              });

              return {
                ...prevCompany,
                pocs: updatedPOCs,
              };
            } else {
              return prevCompany;
            }
          });
        });
      } else {
        toast.error("Something went wrong");
      }
    } catch (error) {
      console.log("error", error);
      toast.error("Network request failed");
    }
  };

  const handleAssignSc = async (event) => {
    const selectedScEmail = event.target.value;
    const normalizedScEmail = selectedScEmail ? selectedScEmail.toLowerCase() : "";

    try {
      const response = await fetch(buildApiUrl("/api/assign-sc"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email || "developer@local", companyId: id, scEmail: normalizedScEmail }),
      });
      const data = await parseJsonResponse(response);

      if (response.ok && data?.success) {
        const assignedScUser = scUsers.find((entry) => entry.email?.toLowerCase() === normalizedScEmail);
        toast.success("LSC assigned successfully");
        setCompanies((prev) =>
          prev.map((company) =>
            company._id === id
              ? { ...company, scEmail: normalizedScEmail, scUserName: assignedScUser?.name || null }
              : company
          )
        );
      } else {
        toast.error(data?.message || "Failed to assign LSC");
      }
    } catch {
      toast.error("Failed to assign LSC");
    }
  };

  const handleDeleteCompany = async () => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      const response = await fetch(buildApiUrl("/api/delete-company"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email || "developer@local",
          companyId: id,
        }),
      });
      const data = await parseJsonResponse(response);

      if (data.success) {
        toast.success("Company deleted successfully");
        setCompanies((prev) => prev.filter((c) => c._id !== id));
      } else {
        toast.error(data.message || "Failed to delete company");
      }
    } catch {
      toast.error("Network request failed");
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isEditingProfiles, setIsEditingProfiles] = useState(false);
  const [editableProfiles, setEditableProfiles] = useState(profiles || []);
  const [profileDraft, setProfileDraft] = useState("");
  const [profileEditIndex, setProfileEditIndex] = useState(-1);
  const [profileEditText, setProfileEditText] = useState("");

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
      toast.error("Profile cannot be empty");
      return;
    }
    if (editableProfiles.some((profile) => profile.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("This profile already exists");
      return;
    }

    setEditableProfiles((prev) => [...prev, trimmed]);
    setProfileDraft("");
  };

  const removeProfile = (index) => {
    const nextProfiles = editableProfiles.filter((_, i) => i !== index);
    if (nextProfiles.length === 0) {
      toast.error("At least one profile is required");
      return;
    }
    setEditableProfiles(nextProfiles);
  };

  const startEditProfile = (index) => {
    setProfileEditIndex(index);
    setProfileEditText(editableProfiles[index] || "");
  };

  const saveProfileEdit = () => {
    const trimmed = profileEditText.trim();
    if (!trimmed) {
      toast.error("Profile cannot be empty");
      return;
    }
    if (
      editableProfiles.some(
        (profile, index) => index !== profileEditIndex && profile.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      toast.error("This profile already exists");
      return;
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
      toast.error("At least one profile is required");
      return;
    }

    try {
      const response = await fetch(buildApiUrl("/api/update-company-profiles"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email || "developer@local",
          companyId: id,
          profiles: editableProfiles,
        }),
      });
      const data = await parseJsonResponse(response);

      if (response.ok && data?.success) {
        toast.success("Profiles updated successfully");
        setIsEditingProfiles(false);
        setProfileDraft("");
        setProfileEditIndex(-1);
        setProfileEditText("");
        setCompanies((prev) =>
          prev.map((company) =>
            company._id === id ? { ...company, profiles: editableProfiles } : company
          )
        );
      } else {
        toast.error(data?.message || "Failed to update profiles");
      }
    } catch (error) {
      console.error(error);
      toast.error("Network request failed");
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 cursor-pointer" onClick={() => setIsOpen((open) => !open)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800 truncate">{name}</h3>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
              {profiles?.length || 0} profile{profiles?.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 truncate">{profiles?.join(" • ") || "No profiles listed"}</p>
        </div>

        <div className="flex items-start gap-3">
          <div className="min-w-[170px] max-w-[240px] rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-left">
            <div className="uppercase tracking-wide text-[10px] font-semibold text-gray-500">Coordinator</div>
            <div className="mt-1 font-semibold text-gray-900 truncate leading-tight">
              {currentScName || currentScEmail || "Unassigned"}
            </div>
            {currentScEmail && (
              <div className="mt-1 text-[10px] text-gray-500 truncate">{currentScEmail}</div>
            )}
          </div>
          <button className={`flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition ${isOpen ? "rotate-180" : "rotate-0"}`}>
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      <div className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-[900px] py-4" : "max-h-0"}`}>
        <div className="px-4 py-3">
          {(userRole === "admin" || userRole === "sc") && (
            <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coordinator assignment</div>
                  <div className="mt-1 text-sm text-gray-600">Assign or reassign the coordinator for this company.</div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={currentScEmail || ""}
                    onChange={handleAssignSc}
                    className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 shadow-sm"
                    aria-label="Assign LSC"
                  >
                    <option value="" className="text-gray-800">Unassigned</option>
                    {scUsers.map((scUser) => (
                      <option key={scUser.email} value={scUser.email} className="text-gray-800">
                        {scUser.name} ({scUser.email})
                      </option>
                    ))}
                  </select>
                  {userRole === "admin" && (
                    <button
                      onClick={() => handleDeleteCompany()}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Delete Company
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <div className="w-full lg:w-1/4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Profiles</h4>
              <div className="flex flex-wrap gap-2">
                {profiles.map((profile, index) => (
                  <div
                    className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[10px] font-medium"
                    key={index}
                  >
                    {profile}
                  </div>
                ))}
              </div>

              {(userRole === "admin" || userRole === "sc") && (
                <div className="mt-3">
                  {isEditingProfiles ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {editableProfiles.length > 0 ? (
                          editableProfiles.map((profile, index) => (
                            <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2">
                              {profileEditIndex === index ? (
                                <>
                                  <input
                                    value={profileEditText}
                                    onChange={(e) => setProfileEditText(e.target.value)}
                                    className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={saveProfileEdit}
                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelProfileEdit}
                                    className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{profile}</span>
                                  <button
                                    type="button"
                                    onClick={() => startEditProfile(index)}
                                    className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-blue-700 border border-blue-100 hover:bg-blue-50 transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeProfile(index)}
                                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 border border-red-100 hover:bg-red-100 transition"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-slate-50 px-3 py-2 text-sm text-gray-500">
                            No profiles added yet. Add one below.
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={profileDraft}
                          onChange={(e) => setProfileDraft(e.target.value)}
                          placeholder="Add new profile"
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={addProfile}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                        >
                          Add profile
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveProfileChanges}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                        >
                          Save profiles
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingProfiles(false);
                            setEditableProfiles(profiles || []);
                            setProfileDraft("");
                            setProfileEditIndex(-1);
                            setProfileEditText("");
                          }}
                          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfiles(true);
                        setEditableProfiles(profiles || []);
                        setProfileDraft("");
                        setProfileEditIndex(-1);
                        setProfileEditText("");
                      }}
                      className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition"
                    >
                      Edit profiles
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="w-full lg:w-3/4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                <span className="rounded-full bg-green-50 px-2 py-1 font-semibold text-green-700">
                  {pocs.length} POC{pocs.length === 1 ? "" : "s"}
                </span>
                <span>Tap the header to expand/collapse</span>
              </div>

              <div className="space-y-2">
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
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function POC({
  name,
  email,
  phone,
  status,
  remarks,
  updateRemarks,
  updateStatus,
  id,
  userRole,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRemark, setEditedRemark] = useState(remarks);

  const handleSave = () => {
    updateRemarks(id, editedRemark);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedRemark(remarks);
    setIsEditing(false);
  };

  // Status color mapping
  const statusColors = {
    "yet to contact": "bg-gray-100 text-gray-700",
    "ongoing": "bg-blue-50 text-blue-700",
    "onboarded": "bg-green-50 text-green-700",
    "rejected": "bg-red-50 text-red-700"
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-4 border border-gray-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="md:w-2/5">
          <div className="font-medium text-gray-800 mb-1">{name}</div>
          {(userRole === 'admin' || userRole === 'sc') && (<div className="flex items-center gap-4 text-sm text-gray-600">
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              title={email}
            >
              <Mail size={16} />
              <span className="hidden sm:inline">{email}</span>
            </a>
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              title={phone}
            >
              <Phone size={16} />
              <span>{phone}</span>
            </a>
          </div>)}
        </div>

        <div className="md:w-1/4">
          <select
            value={status}
            className={`text-sm px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 ${statusColors[status]} cursor-pointer w-full transition-colors`}
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

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h4 className="text-xs font-medium text-gray-500 mb-2">Remarks</h4>
            
            {isEditing ? (
              <textarea
                value={editedRemark}
                onChange={(e) => setEditedRemark(e.target.value)}
                className="w-full p-3 text-sm bg-gray-50 text-gray-800 rounded-md border border-gray-200 resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-600 break-words whitespace-pre-wrap bg-gray-50 p-3 rounded-md min-h-[60px] border border-gray-100">
                {remarks || "No remarks added yet."}
              </p>
            )}
          </div>

          {(userRole === "admin" || userRole === "sc") && (
            <div className="ml-4 flex items-center">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSave}
                    className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                  title="Edit Remarks"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
