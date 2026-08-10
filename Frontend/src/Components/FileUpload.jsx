import React, { useState } from "react";
import axios from "axios";
import { buildApiUrl } from "../api";

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadedCompanies, setUploadedCompanies] = useState([]);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploadStatus(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setError(null);

    try {
      const response = await axios.post(buildApiUrl("/api/add-company-with-file"), formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadStatus({
        success: true,
        message: response.data?.message || "Upload completed successfully",
      });
      setUploadedCompanies(response.data.companies || []);
      setFile(null);
      e.target.reset();
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus({
        success: false,
        message: error.response?.data?.message || "Failed to upload file",
      });
      setError(error.response?.data?.message || "An error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Upload Company Data</h2>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-300 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all relative">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          <p className="mt-2 text-sm text-gray-500">Click to upload or drag and drop</p>
          <p className="text-xs text-gray-400">CSV only</p>
          <input
            type="file"
            accept=".xlsx, .csv, .xls"
            onChange={handleFileChange}
            required
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {file && (
          <div className="mt-4 p-3 bg-gray-200 rounded flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-blue-500 p-2 rounded">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-center gap-6">
          <button
            type="submit"
            disabled={isUploading || !file}
            className={`px-4 py-2 ${isUploading || !file ? 'bg-blue-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-100 transition-colors flex items-center`}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading...
              </>
            ) : (
              'Upload and Submit'
            )}
          </button>
          <a
            href="/sample.csv"
            download = "sample.csv"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-100 transition-colors flex items-center"
          >
            Download sample CSV
          </a>
        </div>
      </form>

      {uploadStatus && (
        <div className={`mt-6 p-4 ${uploadStatus.success ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'} rounded-lg`}>
          <h3 className="font-medium text-lg mb-2">
            {uploadStatus.success ? 'Success!' : 'Error'}
          </h3>
          <p>{uploadStatus.message}</p>
        </div>
      )}

      {uploadedCompanies.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Uploaded Companies</h3>
          <div className="bg-gray-100 rounded-lg border border-gray-300 overflow-hidden shadow-md">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Company</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Profiles</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">POCs</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-300">
                {uploadedCompanies.map((company, index) => (
                  <tr key={company._id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">{company.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {company.profiles.map((profile, i) => (
                        <span key={i} className="inline-block bg-blue-200 text-blue-800 rounded-full px-2 py-0.5 text-xs mr-1 mb-1">
                          {profile}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {company.pocs.length > 0 ? (
                        company.pocs.map((poc, i) => (
                          <div key={i} className="mb-2 last:mb-0">
                            <div className="font-medium">{poc.name}</div>
                            {poc.email && <div className="text-xs text-gray-500">{poc.email}</div>}
                            {poc.phone && <div className="text-xs text-gray-500">{poc.phone}</div>}
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-500 italic">No contacts</span>
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
