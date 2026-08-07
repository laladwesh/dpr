import { useState, useEffect, useCallback } from "react";
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
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scUsers, setScUsers] = useState([]);

  // map to store companies with same dprEmail
  const companiesMap = new Map();
  filteredCompanies.forEach((company) => {
    const dprEmail = company.dprEmail || "";
    const key = dprEmail.toLowerCase();

    if (companiesMap.has(key)) {
      companiesMap.set(key, [...companiesMap.get(key), company]);
    } else {
      companiesMap.set(key, [company]);
    }
  });

  const matchesRoleFilter = useCallback(
    (company) => {
      const normalizedUserEmail = (user?.email || "").toLowerCase();

      if (userRole === "dpr") {
        if (filter === "listed-by-me") {
          return (company.dprEmail || "").toLowerCase() === normalizedUserEmail;
        }
        return true;
      }

      if (userRole === "sc") {
        if (filter === "assigned-to-me") {
          return (company.scEmail || "").toLowerCase() === normalizedUserEmail;
        }
        return true;
      }

      if (userRole === "admin") {
        if (filter === "unassigned") {
          return !company.scEmail || company.scEmail.trim() === "";
        }
        if (filter === "assigned") {
          return Boolean(company.scEmail && company.scEmail.trim() !== "");
        }
        return true;
      }

      return true;
    },
    [filter, user?.email, userRole]
  );

  const matchesStatusFilter = useCallback(
    (company) => {
      if (statusFilter === "all") return true;

      const normalizedStatuses = (company.pocs || []).map((poc) =>
        (poc.status || "").toLowerCase()
      );

      if (statusFilter === "pending") {
        return normalizedStatuses.some((status) =>
          ["yet to contact", "pending", "in progress", "follow up"].includes(status)
        );
      }

      if (statusFilter === "contacted") {
        return normalizedStatuses.some((status) =>
          ["contacted", "interested", "positive", "done", "followed up"].includes(status)
        );
      }

      return true;
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
        profile.toLowerCase()
      );
      let lowerCasePOCs = [];
      let lowerCasePOCEmails = [];

      if (userRole === "admin") {
        lowerCasePOCEmails = (company.pocs || []).map((poc) =>
          (poc.email || "").toLowerCase()
        );
        lowerCasePOCs = (company.pocs || []).map((poc) => (poc.name || "").toLowerCase());
      }

      const lowerCasePOCStatus = (company.pocs || []).map((poc) =>
        (poc.status || "").toLowerCase()
      );

      const matchesSearch =
        searchQuery === "" ||
        lowerCaseDprEmail.includes(lowerCaseQuery) ||
        lowerCaseCompanyName.includes(lowerCaseQuery) ||
        lowerCaseProfiles.some((profile) => profile.includes(lowerCaseQuery)) ||
        lowerCasePOCs.some((poc) => poc.includes(lowerCaseQuery)) ||
        lowerCasePOCEmails.some((email) => email.includes(lowerCaseQuery)) ||
        lowerCasePOCStatus.some((status) => status.includes(lowerCaseQuery));

      return matchesSearch && matchesRoleFilter(company) && matchesStatusFilter(company);
    });

    setFilteredCompanies(filtered);
  }, [searchQuery, companies, userRole, filter, statusFilter, user?.email, matchesRoleFilter, matchesStatusFilter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAllCompanies();
  }, [isAuthenticated, filter, user?.email, fetchAllCompanies]);

  const loadScUsers = useCallback(async () => {
    if (userRole !== "admin") return;

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
    <div className="max-w-6xl mx-auto px-4 py-6 bg-gray-50">
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Company Portal</h1>
            <p className="text-gray-600">Welcome back, {user?.name || "there"}. Manage your companies, follow-ups, and assignments.</p>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            {filteredCompanies.length} company{filteredCompanies.length === 1 ? "" : "ies"} shown
          </div>
        </div>
      </div>
      
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center relative overflow-hidden flex-1">
          <Search className="absolute left-4 text-gray-500" size={20} />
          <input
            type="text"
            name="query"
            placeholder="Search for a company..."
            className="w-full h-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white border border-gray-200 px-5 py-4 pl-12 text-gray-800 placeholder-gray-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {(userRole === "dpr" || userRole === "sc" || userRole === "admin") && (
          <div className="flex flex-wrap items-center gap-2">
            {userRole === "dpr" && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 shadow-sm"
              >
                <option value="all" className="text-gray-800">All Companies</option>
                <option value="listed-by-me" className="text-gray-800">Listed by me</option>
              </select>
            )}

            {userRole === "sc" && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 shadow-sm"
              >
                <option value="all" className="text-gray-800">All Companies</option>
                <option value="assigned-to-me" className="text-gray-800">Assigned to me</option>
              </select>
            )}

            {userRole === "admin" && (
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 shadow-sm"
              >
                <option value="all" className="text-gray-800">All Companies</option>
                <option value="unassigned" className="text-gray-800">Unassigned</option>
                <option value="assigned" className="text-gray-800">Assigned</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 shadow-sm"
            >
              <option value="all" className="text-gray-800">All statuses</option>
              <option value="pending" className="text-gray-800">Pending follow-up</option>
              <option value="contacted" className="text-gray-800">Contacted / positive</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        )}
      </div>
      
      <div className="flex flex-col space-y-4 w-full min-h-screen">
        {Array.from(companiesMap).length > 0 ? (
          Array.from(companiesMap).map(([dprKey, companies], index) => {
            const firstCompany = companies[0] || {};
            const displayName = firstCompany.dprUserName || firstCompany.dprEmail || "Unknown user";
            const displayEmail = firstCompany.dprEmail || dprKey;

            return (
              <DPR
                email={displayEmail}
                displayName={displayName}
                companies={companies}
                setCompanies={setCompanies}
                userRole={userRole}
                scUsers={scUsers}
                key={index}
              />
            );
          })
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

function DPR({ email, displayName, companies, setCompanies, userRole, scUsers }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <div className="mr-3 rounded-full bg-blue-50 p-2 text-blue-600">
            <Mail size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {displayName || email}
            </h2>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>
        <button
          className={`p-2 rounded-full hover:bg-gray-100 transition-all ${
            isOpen ? "rotate-180" : "rotate-0"
          } duration-300`}
        >
          <ChevronDown size={20} className="text-gray-500" />
        </button>
      </div>

      <div
        className={`${
          isOpen ? "max-h-full py-2" : "max-h-0"
        } transition-all duration-300 overflow-hidden`}
      >
        <div className="space-y-4 px-4 pb-4">
          {companies.map((company, index) => (
            <Company
              key={index}
              name={company.name}
              pocs={company.pocs}
              profiles={company.profiles}
              id={company._id}
              currentScEmail={company.scEmail}
              currentScName={company.scUserName || null}
              setCompanies={setCompanies}
              userRole={userRole}
              scUsers={scUsers}
            />
          ))}
        </div>
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

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
     <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
          <div className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            Assigned to: {currentScName || (currentScEmail ? "Assigned" : "Unassigned")}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userRole === "admin" && (
            <>
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
              <button
                onClick={() => handleDeleteCompany()}
                className="text-red-600 text-sm hover:underline"
              >
                Delete Company
              </button>
            </>
          )}
        </div>
      </div>


      <div className="p-5">
        <div className="flex flex-wrap gap-6">
          <div className="w-full lg:w-1/4">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Profiles</h4>
            <div className="flex flex-wrap gap-2">
              {profiles.map((profile, index) => (
                <div
                  className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium"
                  key={index}
                >
                  {profile}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Points of Contact</h4>
            <div className="space-y-3">
                {pocs.map((poc, index) => {
                const displayPOC = userRole === "dpr"
                  ? { ...poc, name: `HR${index + 1}`, email: `hr${index + 1}@example.com`, phone: 'XXXXXXX' }
                  : poc;

                return (
                  <POC
                  key={index}
                  name={displayPOC.name}
                  email={displayPOC.email}
                  phone={displayPOC.phone}
                  status={displayPOC.status}
                  remarks={displayPOC.remarks}
                  updateStatus={updatePOCStatus}
                  updateRemarks={updatePOCRemark}
                  id={poc._id}
                  userRole={userRole}
                  companyId={id}
                  setCompanies={setCompanies}
                  />
                );
              })}
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
