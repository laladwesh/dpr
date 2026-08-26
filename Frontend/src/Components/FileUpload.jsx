import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, X, Download } from "lucide-react";
import { buildApiUrl } from "../api";

const FileUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCompanies, setUploadedCompanies] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || isUploading) {
      if (!file) toast.error("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const response = await toast.promise(
        axios.post(buildApiUrl("/api/add-company-with-file"), formData, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }),
        {
          loading: "Uploading and processing file...",
          success: (res) => res.data?.message || "Upload completed successfully",
          error: (err) => {
            if (err?.response?.status === 401) return "Your session has expired. Please log in again.";
            return err?.response?.data?.message || "Failed to upload file";
          },
        }
      );

      setUploadedCompanies(response.data.companies || []);
      setFile(null);
      e.target.reset();
    } catch (error) {
      console.error("Upload error:", error);
      if (error?.response?.status === 401) {
        navigate("/login", { replace: true });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full font-sans text-slate-800 pb-12 pt-2">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="border-b border-slate-200 pb-4 mb-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Upload Company Data</h1>
          <p className="mt-1 text-sm text-slate-500">
            Bulk-add companies from a spreadsheet instead of entering them one by one.
          </p>
        </div>

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
                href="/sample.csv"
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
                {isUploading ? "Uploading..." : "Upload and Submit"}
              </button>
            </div>
          </form>
        </div>

        {uploadedCompanies.length > 0 && (
          <div className="rounded-xl overflow-hidden">
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
    </div>
  );
};

export default FileUpload;
