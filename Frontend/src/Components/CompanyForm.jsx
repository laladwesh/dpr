import React, { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthProvider";
import { buildApiUrl, parseJsonResponse } from "../api";

const CompanyForm = () => {
  const { user, userRole } = useAuth();
  const [companies, setCompanies] = useState([
    {
      name: "",
      profiles: [""],
      pocs: [{ name: "", email: "", phone: "", remarks: "" }],
    },
  ]);
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
      toast.error("SC users cannot add companies.");
      return;
    }

    try {
      const response = await fetch(buildApiUrl("/api/add-companies"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user?.email || "developer@local",
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
    <div className="max-w-5xl mx-auto my-8 px-4">
      <form className="space-y-8" onSubmit={handleSubmit}>
        {companies.map((company, cIndex) => (
          <div
            key={cIndex}
            className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl"
          >

            {/* Card Content */}
            <div className="p-6">
              {/* Company Name */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  {companies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCompany(cIndex)}
                      className="text-white bg-blue-700 p-2 rounded-full hover:bg-red-500 transition-colors duration-200"
                    >
                      <svg
                        className="size-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Enter company name"
                  value={company.name}
                  onChange={(e) =>
                    handleCompanyChange(cIndex, "name", e.target.value)
                  }
                  required
                  className="w-full px-4 py-3 bg-gray-50 text-gray-800 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-gray-400"
                />
              </div>

              {/* Profiles Section */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Profiles
                  </label>
                  <button
                    type="button"
                    onClick={() => addProfile(cIndex)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <svg
                      className="mr-1.5 h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      ></path>
                    </svg>
                    Add Profile
                  </button>
                </div>
                <div className="space-y-3">
                  {company.profiles.map((profile, rIndex) => (
                    <div 
                      key={rIndex} 
                      className="flex items-center group bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-all duration-200"
                    >
                      <input
                        type="text"
                        placeholder="SDE, Quant, Core, etc."
                        value={profile}
                        onChange={(e) =>
                          handleProfileChange(cIndex, rIndex, e.target.value)
                        }
                        required
                        className="flex-1 px-4 py-3 bg-transparent text-gray-800 focus:outline-none focus:ring-0 border-0 placeholder-gray-400"
                      />
                      {company.profiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProfile(cIndex, rIndex)}
                          className="px-3 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all duration-200 focus:outline-none"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* POC Contacts Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    POC Contacts
                  </label>
                  <button
                    type="button"
                    onClick={() => addPOC(cIndex)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <svg
                      className="mr-1.5 h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      ></path>
                    </svg>
                    Add Contact
                  </button>
                </div>
                <div className="space-y-4">
                  {company.pocs.map((POC, hIndex) => (
                    <div
                      key={hIndex}
                      className="relative p-5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all duration-200"
                    >
                      <div className="flex flex-col gap-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              Name
                            </label>
                            <input
                              type="text"
                              placeholder="Full name"
                              value={POC.name}
                              onChange={(e) =>
                                handlePOCChange(
                                  cIndex,
                                  hIndex,
                                  "name",
                                  e.target.value
                                )
                              }
                              required
                              className="w-full px-4 py-2.5 bg-white text-gray-800 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-gray-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              Email
                            </label>
                            <input
                              type="email"
                              placeholder="example@company.com"
                              value={POC.email}
                              onChange={(e) =>
                                handlePOCChange(
                                  cIndex,
                                  hIndex,
                                  "email",
                                  e.target.value
                                )
                              }
                              className="w-full px-4 py-2.5 bg-white text-gray-800 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-gray-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">
                              Phone
                            </label>
                            <input
                              type="text"
                              placeholder="+1 (123) 456-7890"
                              value={POC.phone}
                              onChange={(e) =>
                                handlePOCChange(
                                  cIndex,
                                  hIndex,
                                  "phone",
                                  e.target.value
                                )
                              }
                              className="w-full px-4 py-2.5 bg-white text-gray-800 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-gray-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">
                            Remarks
                          </label>
                          <textarea
                            placeholder="Additional notes or remarks"
                            value={POC.remarks}
                            onChange={(e) =>
                              handlePOCChange(
                                cIndex,
                                hIndex,
                                "remarks",
                                e.target.value
                              )
                            }
                            rows="2"
                            className="w-full px-4 py-2.5 bg-white text-gray-800 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-gray-400 resize-none"
                          />
                        </div>
                      </div>
                      {company.pocs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePOC(cIndex, hIndex)}
                          className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-white focus:outline-none transition-colors duration-200"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mt-8">
          <button
            type="button"
            onClick={addCompany}
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
            Add Another Company
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center px-8 py-3 font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyForm;