import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, X, Download, Plus } from "lucide-react";
import { buildApiUrl } from "../api";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";

const FileUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  // Editable copy of the preview, keyed by row key. Lets the user fill in
  // missing details in the browser before accepting.
  const [drafts, setDrafts] = useState({});
  const [uploadedCompanies, setUploadedCompanies] = useState([]);
  const [isDragging, setIsDragging] = useState(false);


  useUnsavedChangesWarning(Boolean(file || preview) && !isUploading && !isConfirming);

  const STATUS_OPTIONS = [
    "yet to contact",
    "first email sent",
    "follow up sent",
    "ongoing",
    "onboarded",
    "rejected",
  ];

  const toDraft = (entry, index) => ({
    key: entry._key ?? `row-${index}`,
    name: entry.name || "",
    profilesText: (entry.profiles || []).join("; "),
    pocs: (entry.pocs || []).map((poc) => ({
      name: poc.name || "",
      email: poc.email || "",
      phone: poc.phone || "",
      status: STATUS_OPTIONS.includes(poc.status) ? poc.status : "yet to contact",
      remarks: poc.remarks || "",
    })),
  });

  const receivePreview = (entries) => {
    const keyed = (entries || []).map((entry, index) => ({ ...entry, _key: `row-${Date.now()}-${index}` }));
    setPreview(keyed);
    setDrafts(Object.fromEntries(keyed.map((entry) => [entry._key, toDraft(entry, 0)])));
  };

  const updateDraft = (key, patch) => {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
    // The user is fixing this row; drop stale error flags (local checks take over).
    setPreview((current) =>
      (current || []).map((entry) =>
        entry._key !== key
          ? entry
          : { ...entry, issues: (entry.issues || []).filter((issue) => issue.level !== "error") }
      )
    );
  };

  const updateDraftPoc = (key, pocIndex, patch) => {
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        pocs: current[key].pocs.map((poc, i) => (i === pocIndex ? { ...poc, ...patch } : poc)),
      },
    }));
    setPreview((current) =>
      (current || []).map((entry) =>
        entry._key !== key
          ? entry
          : {
              ...entry,
              pocs: (entry.pocs || []).map((poc, i) =>
                i !== pocIndex ? poc : { ...poc, issues: (poc.issues || []).filter((issue) => issue.level !== "error") }
              ),
            }
      )
    );
  };

  const removePreviewRow = (key) => {
    setPreview((current) => (current || []).filter((entry) => entry._key !== key));
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const addPreviewCompany = () => {
    const key = `manual-${Date.now()}`;
    setPreview((current) => [
      ...(current || []),
      { _key: key, name: "", profiles: [], pocs: [], rowNumbers: [], issues: [], alreadyListed: false, canImport: false },
    ]);
    setDrafts((current) => ({
      ...current,
      [key]: { key, name: "", profilesText: "", pocs: [] },
    }));
  };

  const addPreviewPoc = (key) =>
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        pocs: [
          ...current[key].pocs,
          { name: "", email: "", phone: "", status: "yet to contact", remarks: "" },
        ],
      },
    }));

  const removePreviewPoc = (key, pocIndex) =>
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        pocs: current[key].pocs.filter((_, i) => i !== pocIndex),
      },
    }));

  const draftList = (preview || [])
    .map((entry) => drafts[entry._key])
    .filter(Boolean);

  const draftProfiles = (draft) =>
    draft.profilesText.split(";").map((p) => p.trim()).filter(Boolean);

  const isDraftBlocked = (draft) =>
    !draft.name.trim() ||
    draftProfiles(draft).length === 0 ||
    draft.pocs.some((poc) => !poc.name.trim());

  const blockedCount = draftList.filter(isDraftBlocked).length;

  const acceptFile = (selectedFile) => {
    if (!selectedFile) return;
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const isValid = validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));
    if (!isValid) {
      toast.error("Only .csv, .xlsx, or .xls files are supported.");
      return;
    }
    setFile(selectedFile);
    setUploadedCompanies([]);
  };

  const handleFileChange = (e) => {
    acceptFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleAuthError = (error) => {
    if (error?.response?.status === 401) {
      navigate("/login", { replace: true });
      return true;
    }
    return false;
  };

  // Step 1: upload the file for parsing only - nothing is saved yet.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || isUploading || isConfirming) {
      if (!file) toast.error("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const response = await toast.promise(
        // NOTE: do NOT set Content-Type manually here — the browser must
        // generate the multipart boundary itself, otherwise the server
        // cannot parse the file.
        axios.post(buildApiUrl("/api/preview-company-file"), formData, {
          withCredentials: true,
        }),
        {
          loading: "Reading and validating file...",
          success: (res) => res.data?.message || "File parsed successfully",
          error: (err) => {
            if (err?.response?.status === 401) return "Your session has expired. Please log in again.";
            return err?.response?.data?.message || "Failed to read file";
          },
        }
      );

      receivePreview(response.data.preview || []);
      setUploadedCompanies([]);
      setFile(null);
      e.target.reset();
    } catch (error) {
      console.error("Preview error:", error);
      handleAuthError(error);
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2a: user reviewed (and fixed) the preview and accepts it.
  const handleAccept = async () => {
    if (!draftList.length || isConfirming || blockedCount > 0) return;

    const companies = draftList.map((draft) => ({
      name: draft.name.trim(),
      profiles: draftProfiles(draft),
      pocs: draft.pocs.map((poc) => ({
        name: poc.name.trim(),
        email: poc.email.trim(),
        phone: poc.phone.trim(),
        status: poc.status,
        remarks: poc.remarks.trim(),
      })),
    }));

    setIsConfirming(true);
    try {
      const response = await toast.promise(
        axios.post(
          buildApiUrl("/api/confirm-company-upload"),
          { companies },
          { withCredentials: true }
        ),
        {
          loading: "Saving companies...",
          success: (res) => res.data?.message || "Companies added successfully",
          error: (err) => {
            if (err?.response?.status === 401) return "Your session has expired. Please log in again.";
            return err?.response?.data?.message || "Failed to save companies";
          },
        }
      );

      setUploadedCompanies(response.data.companies || []);
      setPreview(null);
      setDrafts({});
    } catch (error) {
      console.error("Confirm error:", error);
      handleAuthError(error);
    } finally {
      setIsConfirming(false);
    }
  };

  // Step 2b: user rejects the preview - nothing was ever saved, just discard.
  const handleReject = () => {
    setPreview(null);
    setDrafts({});
    toast.success("Upload discarded. Nothing was added.");
  };

  const IssueList = ({ issues }) => {
    if (!issues?.length) return null;
    return (
      <div className="mt-2 space-y-1">
        {issues.map((issue, i) => (
          <p
            key={i}
            className={`text-xs font-medium ${issue.level === "error" ? "text-red-600" : "text-amber-600"}`}
          >
            {issue.level === "error" ? "✕ " : "⚠ "}{issue.message}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl space-y-4 pb-12 font-sans text-slate-800">
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-12 transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
              }`}
            >
              <UploadCloud className={isDragging ? "text-blue-600" : "text-slate-400"} size={36} />
              <p className="text-sm font-medium text-slate-600">
                <span className="text-blue-700 font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-slate-400">CSV, XLSX, or XLS — up to 25MB</p>
              <p className="text-xs text-slate-400">
                One row per contact. Separate multiple profiles with <code className="rounded bg-slate-100 px-1 font-semibold text-slate-600">;</code> and
                multiple remarks with <code className="rounded bg-slate-100 px-1 font-semibold text-slate-600">|</code>.
                Contact status is managed by coordinators and always starts as “Yet to contact”.
              </p>
              <input
                type="file"
                accept=".xlsx,.csv,.xls"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Upload company data file"
              />
            </div>

            {file && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={isUploading}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Remove selected file"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={`${import.meta.env.BASE_URL}sample.csv`}
                download="sample.csv"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Download size={16} />
                Download sample CSV
              </a>
              <button
                type="submit"
                disabled={isUploading || !file}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#192aac] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#12194e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {isUploading ? "Reading file..." : "Upload & preview"}
              </button>
            </div>
          </form>
        </div>

        {preview && (
          <div className="rounded-xl border-2 border-amber-300 bg-white overflow-hidden">
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
              <h2 className="text-sm font-bold text-slate-900">
                Review before adding: {preview.length} compan{preview.length === 1 ? "y" : "ies"} found in file
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Nothing has been saved yet. Fix any flagged details below, then accept to add these to the
                database — or reject to discard everything.
              </p>
            </div>
            <div className="space-y-4 bg-slate-50 p-4 sm:p-6">
              {preview.map((company) => {
                const draft = drafts[company._key];
                if (!draft) return null;
                const blocked = isDraftBlocked(draft);
                return (
                  <div
                    key={company._key}
                    className={`rounded-lg border bg-white p-4 sm:p-5 ${blocked ? "border-red-300" : "border-slate-200"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {company.alreadyListed ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            Already listed — will merge
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            New
                          </span>
                        )}
                        {(company.rowNumbers || []).length > 0 && (
                          <span className="text-xs text-slate-400">
                            File row{(company.rowNumbers || []).length > 1 ? "s" : ""}: {(company.rowNumbers || []).join(", ")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePreviewRow(company._key)}
                        disabled={isConfirming}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Remove ${company.name || "this row"} from import`}
                        title="Remove this row from the import"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Company name *
                        </label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => updateDraft(company._key, { name: e.target.value })}
                          placeholder="e.g. Acme Corporation"
                          disabled={isConfirming}
                          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 transition-colors ${draft.name.trim() ? "border-slate-300 focus:border-blue-600 focus:ring-blue-600" : "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500"}`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Profiles (separate with ;) *
                        </label>
                        <input
                          type="text"
                          value={draft.profilesText}
                          onChange={(e) => updateDraft(company._key, { profilesText: e.target.value })}
                          placeholder="e.g. SDE; Data Analyst"
                          disabled={isConfirming}
                          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 transition-colors ${draftProfiles(draft).length > 0 ? "border-slate-300 focus:border-blue-600 focus:ring-blue-600" : "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500"}`}
                        />
                      </div>
                    </div>
                    <IssueList issues={company.issues} />

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Contacts ({draft.pocs.length})
                        </p>
                        <button
                          type="button"
                          onClick={() => addPreviewPoc(company._key)}
                          disabled={isConfirming}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus size={14} /> Add contact
                        </button>
                      </div>
                      {draft.pocs.length === 0 && (
                        <p className="text-xs italic text-slate-400">No contacts in this row.</p>
                      )}
                      {draft.pocs.map((poc, pIndex) => {
                        const serverPoc = (company.pocs || [])[pIndex];
                        const pocBlocked = !poc.name.trim();
                        return (
                          <div
                            key={pIndex}
                            className={`rounded-md border p-3 ${pocBlocked ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-slate-50"}`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Contact {pIndex + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => removePreviewPoc(company._key, pIndex)}
                                disabled={isConfirming}
                                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Remove contact ${pIndex + 1}`}
                                title="Remove this contact"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input
                                type="text"
                                value={poc.name}
                                onChange={(e) => updateDraftPoc(company._key, pIndex, { name: e.target.value })}
                                placeholder="Contact name *"
                                disabled={isConfirming}
                                className={`w-full rounded-md border bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 transition-colors ${poc.name.trim() ? "border-slate-300 focus:border-blue-600 focus:ring-blue-600" : "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500"}`}
                              />
                              <input
                                type="text"
                                value={poc.email}
                                onChange={(e) => updateDraftPoc(company._key, pIndex, { email: e.target.value })}
                                placeholder="Contact email (optional)"
                                disabled={isConfirming}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
                              />
                              <input
                                type="text"
                                value={poc.phone}
                                onChange={(e) => updateDraftPoc(company._key, pIndex, { phone: e.target.value })}
                                placeholder="Phone (optional)"
                                disabled={isConfirming}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
                              />
                              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm" title="Status is managed by coordinators">
                                <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                                  Yet to contact
                                </span>
                              </div>
                            </div>
                            <textarea
                              value={poc.remarks}
                              onChange={(e) => updateDraftPoc(company._key, pIndex, { remarks: e.target.value })}
                              placeholder="Remarks (optional, separate multiple with |)"
                              rows="1"
                              disabled={isConfirming}
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors resize-none"
                            />
                            <IssueList issues={serverPoc?.issues} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-medium text-slate-500">
                {blockedCount > 0 ? (
                  <span className="text-red-600">
                    {blockedCount} row{blockedCount > 1 ? "s need" : " needs"} a company name, at least one profile, and a name for every contact before accepting.
                  </span>
                ) : (
                  <span className="text-emerald-600">All rows are ready to import.</span>
                )}
              </div>
              <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={addPreviewCompany}
                  disabled={isConfirming}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  Add another company
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isConfirming}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-6 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X size={16} />
                  Reject list
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isConfirming || blockedCount > 0 || draftList.length === 0}
                  title={blockedCount > 0 ? "Fill in the flagged details first" : "Add these companies to the database"}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConfirming && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {isConfirming ? "Saving..." : "Accept & add to database"}
                </button>
              </div>
            </div>
          </div>
        )}

        {uploadedCompanies.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-sm font-bold text-slate-900">
                {uploadedCompanies.length} compan{uploadedCompanies.length === 1 ? "y" : "ies"} processed
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Profiles</th>
                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">POCs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uploadedCompanies.map((company, index) => (
                    <tr key={company._id || index} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">{company.name}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {(company.profiles || []).map((profile, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
                            >
                              {profile}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {company.pocs?.length > 0 ? (
                          <div className="space-y-1.5">
                            {company.pocs.map((poc, i) => (
                              <div key={i}>
                                <div className="font-medium text-slate-700">{poc.name}</div>
                                {poc.email && <div className="text-xs text-slate-400">{poc.email}</div>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="italic text-slate-400">No contacts</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
};

export default FileUpload;
